const hre = require("hardhat");

async function main() {
  console.log("Deploying StreetAccessPassStaking contract...\n");

  // Street Access Pass NFT Contract Address on Ethereum Mainnet
  const STREET_ACCESS_PASS_ADDRESS = "0x3b90aaaa8f3850edbad137b52e2754d25982e173";

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy the contract
  const StakingContract = await hre.ethers.getContractFactory("StreetAccessPassStaking");
  const staking = await StakingContract.deploy(STREET_ACCESS_PASS_ADDRESS);

  await staking.waitForDeployment();

  const contractAddress = await staking.getAddress();
  
  console.log("✅ StreetAccessPassStaking deployed to:", contractAddress);
  console.log("\n📋 Contract Details:");
  console.log("   NFT Contract:", STREET_ACCESS_PASS_ADDRESS);
  console.log("   Token ID:", 1);
  console.log("   Unstake Cooldown: 7 days");
  console.log("\n📊 Staking Tiers:");
  console.log("   Basic:   1 NFT  = $10/month access");
  console.log("   Pro:     5 NFTs = $50/month access");
  console.log("   Premium: 10 NFTs = $300/month access");
  
  console.log("\n🔍 Verify on Etherscan:");
  console.log(`   npx hardhat verify --network mainnet ${contractAddress} "${STREET_ACCESS_PASS_ADDRESS}"`);
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    nftContractAddress: STREET_ACCESS_PASS_ADDRESS,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };
  
  console.log("\n📁 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
