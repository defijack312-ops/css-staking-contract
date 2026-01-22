// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StreetAccessPassStaking
 * @dev Staking contract for Street Access Pass ERC-1155 NFTs
 * 
 * Staking Tiers:
 * - Basic:   1 NFT  = $10/month equivalent access
 * - Pro:     5 NFTs = $50/month equivalent access  
 * - Premium: 10 NFTs = $300/month equivalent access
 *
 * Features:
 * - Adjustable unstaking cooldown period (owner can change)
 * - Tier-based subscription access
 * - Emergency withdrawal by owner
 * - Pause functionality
 */
contract StreetAccessPassStaking is ERC1155Holder, Ownable, ReentrancyGuard {
    
    // ============ Constants ============
    
    uint256 public constant TOKEN_ID = 1; // Street Access Pass token ID
    
    // Tier thresholds
    uint256 public constant BASIC_THRESHOLD = 1;
    uint256 public constant PRO_THRESHOLD = 5;
    uint256 public constant PREMIUM_THRESHOLD = 10;
    
    // Cooldown limits (for safety)
    uint256 public constant MIN_COOLDOWN = 1 hours;
    uint256 public constant MAX_COOLDOWN = 30 days;
    
    // ============ Enums ============
    
    enum Tier { None, Basic, Pro, Premium }
    
    // ============ Structs ============
    
    struct StakeInfo {
        uint256 amount;           // Number of NFTs staked
        uint256 stakedAt;         // Timestamp when staked
        uint256 unstakeRequestedAt; // Timestamp when unstake was requested (0 if not requested)
        Tier tier;                // Current subscription tier
    }
    
    // ============ State Variables ============
    
    IERC1155 public immutable nftContract;
    
    mapping(address => StakeInfo) public stakes;
    
    uint256 public totalStaked;
    uint256 public totalStakers;
    
    bool public paused;
    
    // Adjustable cooldown (can be changed by owner)
    uint256 public unstakeCooldown;
    
    // ============ Events ============
    
    event Staked(address indexed user, uint256 amount, Tier tier, uint256 timestamp);
    event UnstakeRequested(address indexed user, uint256 amount, uint256 availableAt);
    event UnstakeCancelled(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event TierChanged(address indexed user, Tier oldTier, Tier newTier);
    event Paused(bool isPaused);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    
    // ============ Errors ============
    
    error ContractPaused();
    error InvalidAmount();
    error InsufficientBalance();
    error NoStake();
    error UnstakeNotRequested();
    error CooldownNotComplete();
    error AlreadyUnstaking();
    error NotUnstaking();
    error TransferFailed();
    error InvalidCooldown();
    
    // ============ Modifiers ============
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @dev Constructor sets the NFT contract address and initial cooldown
     * @param _nftContract Address of the Street Access Pass ERC-1155 contract
     * @param _initialCooldown Initial unstaking cooldown period in seconds
     */
    constructor(address _nftContract, uint256 _initialCooldown) Ownable(msg.sender) {
        if (_initialCooldown < MIN_COOLDOWN || _initialCooldown > MAX_COOLDOWN) {
            revert InvalidCooldown();
        }
        nftContract = IERC1155(_nftContract);
        unstakeCooldown = _initialCooldown;
    }
    
    // ============ External Functions ============
    
    /**
     * @dev Stake NFTs to gain subscription access
     * @param amount Number of NFTs to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        // Check user has enough NFTs
        uint256 userBalance = nftContract.balanceOf(msg.sender, TOKEN_ID);
        if (userBalance < amount) revert InsufficientBalance();
        
        StakeInfo storage userStake = stakes[msg.sender];
        
        // Can't stake while in unstaking cooldown
        if (userStake.unstakeRequestedAt != 0) revert AlreadyUnstaking();
        
        // Track if this is a new staker
        bool isNewStaker = userStake.amount == 0;
        
        // Calculate new tier
        Tier oldTier = userStake.tier;
        uint256 newAmount = userStake.amount + amount;
        Tier newTier = _calculateTier(newAmount);
        
        // Update stake info
        userStake.amount = newAmount;
        userStake.stakedAt = block.timestamp;
        userStake.tier = newTier;
        
        // Update totals
        totalStaked += amount;
        if (isNewStaker) {
            totalStakers += 1;
        }
        
        // Transfer NFTs to this contract
        nftContract.safeTransferFrom(msg.sender, address(this), TOKEN_ID, amount, "");
        
        emit Staked(msg.sender, amount, newTier, block.timestamp);
        
        if (oldTier != newTier) {
            emit TierChanged(msg.sender, oldTier, newTier);
        }
    }
    
    /**
     * @dev Add more NFTs to existing stake
     * @param amount Number of additional NFTs to stake
     */
    function addToStake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        StakeInfo storage userStake = stakes[msg.sender];
        if (userStake.amount == 0) revert NoStake();
        if (userStake.unstakeRequestedAt != 0) revert AlreadyUnstaking();
        
        uint256 userBalance = nftContract.balanceOf(msg.sender, TOKEN_ID);
        if (userBalance < amount) revert InsufficientBalance();
        
        Tier oldTier = userStake.tier;
        uint256 newAmount = userStake.amount + amount;
        Tier newTier = _calculateTier(newAmount);
        
        userStake.amount = newAmount;
        userStake.tier = newTier;
        
        totalStaked += amount;
        
        nftContract.safeTransferFrom(msg.sender, address(this), TOKEN_ID, amount, "");
        
        emit Staked(msg.sender, amount, newTier, block.timestamp);
        
        if (oldTier != newTier) {
            emit TierChanged(msg.sender, oldTier, newTier);
        }
    }
    
    /**
     * @dev Request to unstake - starts cooldown period
     */
    function requestUnstake() external nonReentrant whenNotPaused {
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.amount == 0) revert NoStake();
        if (userStake.unstakeRequestedAt != 0) revert AlreadyUnstaking();
        
        userStake.unstakeRequestedAt = block.timestamp;
        
        uint256 availableAt = block.timestamp + unstakeCooldown;
        
        emit UnstakeRequested(msg.sender, userStake.amount, availableAt);
    }
    
    /**
     * @dev Cancel unstake request and keep subscription
     */
    function cancelUnstake() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.unstakeRequestedAt == 0) revert NotUnstaking();
        
        uint256 amount = userStake.amount;
        userStake.unstakeRequestedAt = 0;
        
        emit UnstakeCancelled(msg.sender, amount);
    }
    
    /**
     * @dev Complete unstake after cooldown period
     */
    function completeUnstake() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.amount == 0) revert NoStake();
        if (userStake.unstakeRequestedAt == 0) revert UnstakeNotRequested();
        
        uint256 cooldownEnd = userStake.unstakeRequestedAt + unstakeCooldown;
        if (block.timestamp < cooldownEnd) revert CooldownNotComplete();
        
        uint256 amount = userStake.amount;
        Tier oldTier = userStake.tier;
        
        // Clear stake info
        delete stakes[msg.sender];
        
        // Update totals
        totalStaked -= amount;
        totalStakers -= 1;
        
        // Transfer NFTs back to user
        nftContract.safeTransferFrom(address(this), msg.sender, TOKEN_ID, amount, "");
        
        emit Unstaked(msg.sender, amount, block.timestamp);
        emit TierChanged(msg.sender, oldTier, Tier.None);
    }
    
    /**
     * @dev Partial unstake - reduce stake amount
     * @param amount Number of NFTs to unstake
     * Note: Still requires going through cooldown for the full stake first
     */
    function partialUnstake(uint256 amount) external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.amount == 0) revert NoStake();
        if (amount == 0 || amount > userStake.amount) revert InvalidAmount();
        if (userStake.unstakeRequestedAt == 0) revert UnstakeNotRequested();
        
        uint256 cooldownEnd = userStake.unstakeRequestedAt + unstakeCooldown;
        if (block.timestamp < cooldownEnd) revert CooldownNotComplete();
        
        Tier oldTier = userStake.tier;
        uint256 newAmount = userStake.amount - amount;
        Tier newTier = _calculateTier(newAmount);
        
        if (newAmount == 0) {
            // Full unstake
            delete stakes[msg.sender];
            totalStakers -= 1;
        } else {
            // Partial unstake
            userStake.amount = newAmount;
            userStake.tier = newTier;
            userStake.unstakeRequestedAt = 0; // Reset cooldown
        }
        
        totalStaked -= amount;
        
        nftContract.safeTransferFrom(address(this), msg.sender, TOKEN_ID, amount, "");
        
        emit Unstaked(msg.sender, amount, block.timestamp);
        
        if (oldTier != newTier) {
            emit TierChanged(msg.sender, oldTier, newTier);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get user's stake information
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 stakedAt,
        uint256 unstakeRequestedAt,
        uint256 unstakeAvailableAt,
        Tier tier,
        bool isInCooldown,
        uint256 cooldownSecondsRemaining
    ) {
        StakeInfo storage userStake = stakes[user];
        
        amount = userStake.amount;
        stakedAt = userStake.stakedAt;
        unstakeRequestedAt = userStake.unstakeRequestedAt;
        tier = userStake.tier;
        
        if (unstakeRequestedAt != 0) {
            unstakeAvailableAt = unstakeRequestedAt + unstakeCooldown;
            isInCooldown = block.timestamp < unstakeAvailableAt;
            cooldownSecondsRemaining = isInCooldown ? unstakeAvailableAt - block.timestamp : 0;
        }
    }
    
    /**
     * @dev Get user's current tier
     */
    function getUserTier(address user) external view returns (Tier) {
        return stakes[user].tier;
    }
    
    /**
     * @dev Check if user has at least a certain tier
     */
    function hasMinimumTier(address user, Tier minimumTier) external view returns (bool) {
        return stakes[user].tier >= minimumTier;
    }
    
    /**
     * @dev Get tier for a given stake amount
     */
    function getTierForAmount(uint256 amount) external pure returns (Tier) {
        return _calculateTier(amount);
    }
    
    /**
     * @dev Get contract stats
     */
    function getContractStats() external view returns (
        uint256 _totalStaked,
        uint256 _totalStakers,
        uint256 contractBalance,
        uint256 currentCooldown
    ) {
        _totalStaked = totalStaked;
        _totalStakers = totalStakers;
        contractBalance = nftContract.balanceOf(address(this), TOKEN_ID);
        currentCooldown = unstakeCooldown;
    }
    
    /**
     * @dev Get current cooldown period
     */
    function getCooldown() external view returns (uint256) {
        return unstakeCooldown;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Update the unstaking cooldown period
     * @param newCooldown New cooldown period in seconds
     * 
     * Note: This only affects NEW unstake requests.
     * Users already in cooldown will use the cooldown that was active when they requested.
     */
    function setCooldown(uint256 newCooldown) external onlyOwner {
        if (newCooldown < MIN_COOLDOWN || newCooldown > MAX_COOLDOWN) {
            revert InvalidCooldown();
        }
        
        uint256 oldCooldown = unstakeCooldown;
        unstakeCooldown = newCooldown;
        
        emit CooldownUpdated(oldCooldown, newCooldown);
    }
    
    /**
     * @dev Pause/unpause the contract
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
    
    /**
     * @dev Emergency withdraw for a user (admin only, bypasses cooldown)
     * Use only in emergencies like contract migration
     */
    function emergencyWithdrawFor(address user) external onlyOwner nonReentrant {
        StakeInfo storage userStake = stakes[user];
        
        if (userStake.amount == 0) revert NoStake();
        
        uint256 amount = userStake.amount;
        
        delete stakes[user];
        totalStaked -= amount;
        totalStakers -= 1;
        
        nftContract.safeTransferFrom(address(this), user, TOKEN_ID, amount, "");
        
        emit EmergencyWithdraw(user, amount);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Calculate tier based on staked amount
     */
    function _calculateTier(uint256 amount) internal pure returns (Tier) {
        if (amount >= PREMIUM_THRESHOLD) return Tier.Premium;
        if (amount >= PRO_THRESHOLD) return Tier.Pro;
        if (amount >= BASIC_THRESHOLD) return Tier.Basic;
        return Tier.None;
    }
    
    // ============ Required Overrides ============
    
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(ERC1155Holder) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
