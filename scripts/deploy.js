const hre = require("hardhat");

async function main() {
  // Street Access Pass NFT contract on mainnet
  const NFT_CONTRACT = "0x3b90aaaa8f3850edbad137b52e2754d25982e173";
  
  // Initial cooldown: 1 hour (for testing)
  // Can be changed later to 7 days (604800 seconds) using setCooldown()
  const INITIAL_COOLDOWN = 1 * 60 * 60; // 1 hour in seconds
  
  console.log("Deploying StreetAccessPassStaking...");
  console.log("NFT Contract:", NFT_CONTRACT);
  console.log("Initial Cooldown:", INITIAL_COOLDOWN, "seconds (1 hour)");
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("");

  // Get current gas price
  const feeData = await hre.ethers.provider.getFeeData();
  console.log("Current gas price:", hre.ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei");
  console.log("");

  // Deploy
  const StakingContract = await hre.ethers.getContractFactory("StreetAccessPassStaking");
  const staking = await StakingContract.deploy(NFT_CONTRACT, INITIAL_COOLDOWN);
  
  await staking.waitForDeployment();
  
  const contractAddress = await staking.getAddress();
  
  console.log("========================================");
  console.log("StreetAccessPassStaking deployed to:", contractAddress);
  console.log("========================================");
  console.log("");
  console.log("Next steps:");
  console.log("1. Verify on Etherscan:");
  console.log(`   npx hardhat verify --network mainnet ${contractAddress} "${NFT_CONTRACT}" "${INITIAL_COOLDOWN}"`);
  console.log("");
  console.log("2. Update your frontend with the new contract address");
  console.log("");
  console.log("3. To change cooldown to 7 days later:");
  console.log("   Run: npm run set-cooldown");
  console.log("   Or call: setCooldown(604800)");
  console.log("");
  
  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    nftContract: NFT_CONTRACT,
    initialCooldown: INITIAL_COOLDOWN,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    cooldownValues: {
      "1_hour": 3600,
      "1_day": 86400,
      "7_days": 604800,
      "30_days": 2592000
    }
  };
  
  fs.writeFileSync(
    `deployment-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment info saved to deployment-${hre.network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
