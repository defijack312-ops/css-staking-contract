# Street Access Pass Staking Contract v2.0

Staking contract for Street Access Pass ERC-1155 NFTs with **adjustable cooldown**.

## Key Changes from v1

- **Adjustable Cooldown**: Owner can change the unstaking cooldown period at any time
- **Constructor Parameter**: Initial cooldown is set at deployment
- **Safety Limits**: Cooldown must be between 1 hour and 30 days

## Staking Tiers

| Tier | NFTs Required | Monthly Value |
|------|---------------|---------------|
| Basic | 1 NFT | $10/month |
| Pro | 5 NFTs | $50/month |
| Premium | 10 NFTs | $300/month |

## Deployment

### 1. Setup

```bash
cd staking-mainnet
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

**Important**: Use a NEW wallet for mainnet deployment (not your personal wallet).

Required values:
- `PRIVATE_KEY` - Deployer wallet private key (without 0x)
- `MAINNET_RPC_URL` - Alchemy or Infura mainnet RPC URL
- `ETHERSCAN_API_KEY` - For contract verification (get from etherscan.io)

### 3. Fund Your Wallet

Send ~0.05-0.1 ETH to your deployment wallet for gas fees.

Check current gas prices: https://etherscan.io/gastracker

### 4. Compile

```bash
npm run compile
```

### 5. Deploy to Mainnet

```bash
npm run deploy:mainnet
```

This will:
- Deploy with **1 hour** initial cooldown (for testing)
- Save deployment info to `deployment-mainnet.json`
- Output the contract address

### 6. Verify on Etherscan

```bash
npx hardhat verify --network mainnet <CONTRACT_ADDRESS> "0x3b90aaaa8f3850edbad137b52e2754d25982e173" "3600"
```

### 7. Update Frontend

Update your `.env.local` in the CSS Insights web app:

```
NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS=<new_mainnet_address>
```

Then redeploy to Netlify.

## Changing Cooldown

To change the cooldown from 1 hour to 7 days:

```bash
npm run set-cooldown
```

Or manually call `setCooldown(604800)` on the contract.

### Cooldown Reference Values

| Duration | Seconds |
|----------|---------|
| 1 hour | 3600 |
| 1 day | 86400 |
| 7 days | 604800 |
| 14 days | 1209600 |
| 30 days | 2592000 |

## Admin Functions

| Function | Description |
|----------|-------------|
| `setCooldown(uint256)` | Change unstaking cooldown (owner only) |
| `setPaused(bool)` | Pause/unpause contract (owner only) |
| `emergencyWithdrawFor(address)` | Return user's NFTs bypassing cooldown (owner only, emergencies) |

## Contract Addresses

### Mainnet
- **NFT Contract**: `0x3b90aaaa8f3850edbad137b52e2754d25982e173`
- **Staking Contract**: (after deployment)

### Sepolia (Testing)
- **Previous Test Contract**: `0x8FE531e9789b551cBf64C7BFCFA55Af910a3Eb37`

## Security Notes

1. Only the contract owner can change the cooldown
2. Cooldown is bounded between 1 hour and 30 days
3. Changes only affect NEW unstake requests
4. Users in cooldown continue with their original cooldown time
5. NFTs are held in the contract (escrow), not sent to owner wallet

## Gas Estimates

| Operation | Estimated Gas | ~Cost at 20 gwei |
|-----------|---------------|------------------|
| Deploy | ~1.5M gas | ~$50-75 |
| Stake | ~150k gas | ~$5-8 |
| Request Unstake | ~50k gas | ~$2-3 |
| Complete Unstake | ~100k gas | ~$3-5 |
| Set Cooldown | ~30k gas | ~$1-2 |
