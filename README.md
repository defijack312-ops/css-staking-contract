# Street Access Pass Staking Contract

A Solidity smart contract for staking Street Access Pass ERC-1155 NFTs to gain subscription access to CSS Insights.

## 🎯 Overview

This contract allows holders of the Street Access Pass NFT to stake their tokens in exchange for tiered subscription access:

| Tier | NFTs Required | Monthly Value |
|------|---------------|---------------|
| Basic | 1 NFT | $10/month |
| Pro | 5 NFTs | $50/month |
| Premium | 10 NFTs | $300/month |

## 🔐 Security Features

- **7-Day Unstaking Cooldown**: Prevents flash-staking attacks
- **ReentrancyGuard**: Protects against reentrancy attacks
- **Pausable**: Contract can be paused in emergencies
- **Ownable**: Admin functions restricted to owner
- **Emergency Withdraw**: Admin can rescue stuck funds

## 📋 Contract Details

- **NFT Contract**: `0x3b90aaaa8f3850edbad137b52e2754d25982e173`
- **Token Standard**: ERC-1155
- **Token ID**: 1
- **Network**: Ethereum Mainnet

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- npm or yarn

### Installation

```bash
cd contracts
npm install
```

### Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Fill in your credentials:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_deployer_private_key
ETHERSCAN_API_KEY=your_etherscan_key
```

### Compile

```bash
npm run compile
```

### Test

```bash
npm test
```

### Deploy

**To Sepolia Testnet (recommended first):**
```bash
npm run deploy:sepolia
```

**To Ethereum Mainnet:**
```bash
npm run deploy:mainnet
```

### Verify on Etherscan

After deployment:
```bash
npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "0x3b90aaaa8f3850edbad137b52e2754d25982e173"
```

## 📖 Contract Functions

### User Functions

#### `stake(uint256 amount)`
Stake NFTs to gain subscription access.
- Requires prior approval of the staking contract
- Cannot stake while in unstaking cooldown

#### `addToStake(uint256 amount)`
Add more NFTs to existing stake.
- Upgrades tier if threshold reached

#### `requestUnstake()`
Request to unstake all NFTs.
- Starts 7-day cooldown period
- User keeps access during cooldown

#### `cancelUnstake()`
Cancel unstake request and keep subscription.

#### `completeUnstake()`
Complete unstake after cooldown ends.
- Returns all NFTs to user
- Removes subscription access

#### `partialUnstake(uint256 amount)`
Unstake some NFTs after cooldown.
- May downgrade tier

### View Functions

#### `getStakeInfo(address user)`
Returns complete stake information:
- Amount staked
- Stake timestamp
- Unstake request timestamp
- Cooldown status
- Current tier

#### `getUserTier(address user)`
Returns user's current tier (None, Basic, Pro, Premium).

#### `hasMinimumTier(address user, Tier minimumTier)`
Check if user has at least the specified tier.

#### `getContractStats()`
Returns total staked, total stakers, and contract balance.

### Admin Functions

#### `setPaused(bool _paused)`
Pause/unpause the contract.

#### `emergencyWithdrawFor(address user)`
Emergency function to return NFTs to user (bypasses cooldown).

## 🔄 Integration with Website

### Reading Stake Status (Web3/Ethers.js)

```javascript
import { ethers } from 'ethers';

const stakingAddress = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
const stakingABI = [...]; // Contract ABI

const provider = new ethers.BrowserProvider(window.ethereum);
const staking = new ethers.Contract(stakingAddress, stakingABI, provider);

// Get user's stake info
const stakeInfo = await staking.getStakeInfo(userAddress);
console.log('Staked:', stakeInfo.amount.toString());
console.log('Tier:', stakeInfo.tier); // 0=None, 1=Basic, 2=Pro, 3=Premium

// Check if user has minimum tier
const hasProAccess = await staking.hasMinimumTier(userAddress, 2);
```

### Staking NFTs

```javascript
const signer = await provider.getSigner();
const stakingWithSigner = staking.connect(signer);

// First, approve the staking contract
const nftContract = new ethers.Contract(nftAddress, erc1155ABI, signer);
await nftContract.setApprovalForAll(stakingAddress, true);

// Then stake
await stakingWithSigner.stake(5); // Stake 5 NFTs for Pro tier
```

## ⚠️ Important Notes

1. **Approval Required**: Users must approve the staking contract before staking
2. **NFTs Locked**: Staked NFTs are held by the contract
3. **7-Day Cooldown**: Users must wait 7 days after requesting unstake
4. **Tier Changes**: If user sells NFTs while staked (shouldn't be possible), contract handles edge cases

## 🛡️ Security Considerations

Before deploying to mainnet:

1. **Get an Audit**: Consider professional audit for mainnet deployment
2. **Test Thoroughly**: Test on Sepolia first
3. **Start Paused**: Deploy paused, then unpause after verification
4. **Multisig Owner**: Transfer ownership to a multisig after deployment

## 📜 License

MIT License

## 🔗 Links

- [Street Access Pass on OpenSea](https://opensea.io/collection/street-access-pass)
- [CSS Insights](https://cssinsights.com)
