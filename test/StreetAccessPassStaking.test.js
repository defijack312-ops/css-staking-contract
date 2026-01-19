const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("StreetAccessPassStaking", function () {
  let staking;
  let mockNFT;
  let owner;
  let user1;
  let user2;
  
  const TOKEN_ID = 1;
  const SEVEN_DAYS = 7 * 24 * 60 * 60;
  
  // Tier enum values
  const Tier = {
    None: 0,
    Basic: 1,
    Pro: 2,
    Premium: 3,
  };

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy mock ERC1155 NFT contract
    const MockERC1155 = await ethers.getContractFactory("MockERC1155");
    mockNFT = await MockERC1155.deploy();
    await mockNFT.waitForDeployment();
    
    // Deploy staking contract
    const StakingContract = await ethers.getContractFactory("StreetAccessPassStaking");
    staking = await StakingContract.deploy(await mockNFT.getAddress());
    await staking.waitForDeployment();
    
    // Mint NFTs to users for testing
    await mockNFT.mint(user1.address, TOKEN_ID, 20); // User1 gets 20 NFTs
    await mockNFT.mint(user2.address, TOKEN_ID, 5);  // User2 gets 5 NFTs
    
    // Approve staking contract to transfer NFTs
    await mockNFT.connect(user1).setApprovalForAll(await staking.getAddress(), true);
    await mockNFT.connect(user2).setApprovalForAll(await staking.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the correct NFT contract", async function () {
      expect(await staking.nftContract()).to.equal(await mockNFT.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await staking.owner()).to.equal(owner.address);
    });

    it("Should start unpaused", async function () {
      expect(await staking.paused()).to.equal(false);
    });
  });

  describe("Staking", function () {
    it("Should stake NFTs and assign Basic tier (1 NFT)", async function () {
      await staking.connect(user1).stake(1);
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(1);
      expect(stakeInfo.tier).to.equal(Tier.Basic);
    });

    it("Should stake NFTs and assign Pro tier (5 NFTs)", async function () {
      await staking.connect(user1).stake(5);
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(5);
      expect(stakeInfo.tier).to.equal(Tier.Pro);
    });

    it("Should stake NFTs and assign Premium tier (10 NFTs)", async function () {
      await staking.connect(user1).stake(10);
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(10);
      expect(stakeInfo.tier).to.equal(Tier.Premium);
    });

    it("Should transfer NFTs to contract when staking", async function () {
      const stakingAddress = await staking.getAddress();
      
      await staking.connect(user1).stake(5);
      
      expect(await mockNFT.balanceOf(stakingAddress, TOKEN_ID)).to.equal(5);
      expect(await mockNFT.balanceOf(user1.address, TOKEN_ID)).to.equal(15);
    });

    it("Should update total staked and stakers", async function () {
      await staking.connect(user1).stake(5);
      await staking.connect(user2).stake(3);
      
      expect(await staking.totalStaked()).to.equal(8);
      expect(await staking.totalStakers()).to.equal(2);
    });

    it("Should emit Staked event", async function () {
      await expect(staking.connect(user1).stake(5))
        .to.emit(staking, "Staked")
        .withArgs(user1.address, 5, Tier.Pro, await time.latest() + 1);
    });

    it("Should revert if staking 0 NFTs", async function () {
      await expect(staking.connect(user1).stake(0))
        .to.be.revertedWithCustomError(staking, "InvalidAmount");
    });

    it("Should revert if insufficient balance", async function () {
      await expect(staking.connect(user1).stake(100))
        .to.be.revertedWithCustomError(staking, "InsufficientBalance");
    });

    it("Should revert if contract is paused", async function () {
      await staking.setPaused(true);
      
      await expect(staking.connect(user1).stake(5))
        .to.be.revertedWithCustomError(staking, "ContractPaused");
    });
  });

  describe("Add to Stake", function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(3);
    });

    it("Should add to existing stake and upgrade tier", async function () {
      await staking.connect(user1).addToStake(2);
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(5);
      expect(stakeInfo.tier).to.equal(Tier.Pro);
    });

    it("Should emit TierChanged event when tier upgrades", async function () {
      await expect(staking.connect(user1).addToStake(2))
        .to.emit(staking, "TierChanged")
        .withArgs(user1.address, Tier.Basic, Tier.Pro);
    });

    it("Should revert if no existing stake", async function () {
      await expect(staking.connect(user2).addToStake(2))
        .to.be.revertedWithCustomError(staking, "NoStake");
    });
  });

  describe("Request Unstake", function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(5);
    });

    it("Should request unstake and start cooldown", async function () {
      await staking.connect(user1).requestUnstake();
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.unstakeRequestedAt).to.be.gt(0);
      expect(stakeInfo.isInCooldown).to.equal(true);
    });

    it("Should calculate correct cooldown end time", async function () {
      await staking.connect(user1).requestUnstake();
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      const expectedAvailableAt = stakeInfo.unstakeRequestedAt + BigInt(SEVEN_DAYS);
      expect(stakeInfo.unstakeAvailableAt).to.equal(expectedAvailableAt);
    });

    it("Should emit UnstakeRequested event", async function () {
      const tx = await staking.connect(user1).requestUnstake();
      const timestamp = await time.latest();
      
      await expect(tx)
        .to.emit(staking, "UnstakeRequested")
        .withArgs(user1.address, 5, timestamp + SEVEN_DAYS);
    });

    it("Should revert if no stake", async function () {
      await expect(staking.connect(user2).requestUnstake())
        .to.be.revertedWithCustomError(staking, "NoStake");
    });

    it("Should revert if already unstaking", async function () {
      await staking.connect(user1).requestUnstake();
      
      await expect(staking.connect(user1).requestUnstake())
        .to.be.revertedWithCustomError(staking, "AlreadyUnstaking");
    });
  });

  describe("Cancel Unstake", function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(5);
      await staking.connect(user1).requestUnstake();
    });

    it("Should cancel unstake request", async function () {
      await staking.connect(user1).cancelUnstake();
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.unstakeRequestedAt).to.equal(0);
      expect(stakeInfo.isInCooldown).to.equal(false);
    });

    it("Should emit UnstakeCancelled event", async function () {
      await expect(staking.connect(user1).cancelUnstake())
        .to.emit(staking, "UnstakeCancelled")
        .withArgs(user1.address, 5);
    });

    it("Should revert if not unstaking", async function () {
      await staking.connect(user1).cancelUnstake();
      
      await expect(staking.connect(user1).cancelUnstake())
        .to.be.revertedWithCustomError(staking, "NotUnstaking");
    });
  });

  describe("Complete Unstake", function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(5);
      await staking.connect(user1).requestUnstake();
    });

    it("Should complete unstake after cooldown", async function () {
      await time.increase(SEVEN_DAYS + 1);
      
      await staking.connect(user1).completeUnstake();
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(0);
      expect(stakeInfo.tier).to.equal(Tier.None);
    });

    it("Should return NFTs to user", async function () {
      await time.increase(SEVEN_DAYS + 1);
      
      const balanceBefore = await mockNFT.balanceOf(user1.address, TOKEN_ID);
      await staking.connect(user1).completeUnstake();
      const balanceAfter = await mockNFT.balanceOf(user1.address, TOKEN_ID);
      
      expect(balanceAfter - balanceBefore).to.equal(5);
    });

    it("Should update totals", async function () {
      await time.increase(SEVEN_DAYS + 1);
      
      await staking.connect(user1).completeUnstake();
      
      expect(await staking.totalStaked()).to.equal(0);
      expect(await staking.totalStakers()).to.equal(0);
    });

    it("Should emit Unstaked and TierChanged events", async function () {
      await time.increase(SEVEN_DAYS + 1);
      
      const tx = await staking.connect(user1).completeUnstake();
      
      await expect(tx).to.emit(staking, "Unstaked");
      await expect(tx)
        .to.emit(staking, "TierChanged")
        .withArgs(user1.address, Tier.Pro, Tier.None);
    });

    it("Should revert if cooldown not complete", async function () {
      await time.increase(SEVEN_DAYS - 100); // Not quite 7 days
      
      await expect(staking.connect(user1).completeUnstake())
        .to.be.revertedWithCustomError(staking, "CooldownNotComplete");
    });

    it("Should revert if unstake not requested", async function () {
      await staking.connect(user1).cancelUnstake();
      
      await expect(staking.connect(user1).completeUnstake())
        .to.be.revertedWithCustomError(staking, "UnstakeNotRequested");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await staking.connect(user1).stake(10);
    });

    it("Should return correct user tier", async function () {
      expect(await staking.getUserTier(user1.address)).to.equal(Tier.Premium);
    });

    it("Should check minimum tier correctly", async function () {
      expect(await staking.hasMinimumTier(user1.address, Tier.Basic)).to.equal(true);
      expect(await staking.hasMinimumTier(user1.address, Tier.Pro)).to.equal(true);
      expect(await staking.hasMinimumTier(user1.address, Tier.Premium)).to.equal(true);
      expect(await staking.hasMinimumTier(user2.address, Tier.Basic)).to.equal(false);
    });

    it("Should return correct tier for amount", async function () {
      expect(await staking.getTierForAmount(0)).to.equal(Tier.None);
      expect(await staking.getTierForAmount(1)).to.equal(Tier.Basic);
      expect(await staking.getTierForAmount(4)).to.equal(Tier.Basic);
      expect(await staking.getTierForAmount(5)).to.equal(Tier.Pro);
      expect(await staking.getTierForAmount(9)).to.equal(Tier.Pro);
      expect(await staking.getTierForAmount(10)).to.equal(Tier.Premium);
      expect(await staking.getTierForAmount(100)).to.equal(Tier.Premium);
    });

    it("Should return correct contract stats", async function () {
      const stats = await staking.getContractStats();
      expect(stats._totalStaked).to.equal(10);
      expect(stats._totalStakers).to.equal(1);
      expect(stats.contractBalance).to.equal(10);
    });
  });

  describe("Admin Functions", function () {
    it("Should pause and unpause", async function () {
      await staking.setPaused(true);
      expect(await staking.paused()).to.equal(true);
      
      await staking.setPaused(false);
      expect(await staking.paused()).to.equal(false);
    });

    it("Should emit Paused event", async function () {
      await expect(staking.setPaused(true))
        .to.emit(staking, "Paused")
        .withArgs(true);
    });

    it("Should only allow owner to pause", async function () {
      await expect(staking.connect(user1).setPaused(true))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("Should emergency withdraw for user", async function () {
      await staking.connect(user1).stake(5);
      
      const balanceBefore = await mockNFT.balanceOf(user1.address, TOKEN_ID);
      await staking.emergencyWithdrawFor(user1.address);
      const balanceAfter = await mockNFT.balanceOf(user1.address, TOKEN_ID);
      
      expect(balanceAfter - balanceBefore).to.equal(5);
      expect(await staking.totalStaked()).to.equal(0);
    });

    it("Should emit EmergencyWithdraw event", async function () {
      await staking.connect(user1).stake(5);
      
      await expect(staking.emergencyWithdrawFor(user1.address))
        .to.emit(staking, "EmergencyWithdraw")
        .withArgs(user1.address, 5);
    });
  });
});


// Mock ERC1155 contract for testing
const MockERC1155Code = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {
    constructor() ERC1155("") {}
    
    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }
}
`;
