const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Load deployment info
  const deploymentFile = `deployment-${hre.network.name}.json`;
  
  if (!fs.existsSync(deploymentFile)) {
    console.error(`Deployment file not found: ${deploymentFile}`);
    console.error("Please deploy the contract first.");
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contractAddress = deployment.contractAddress;
  
  // New cooldown: 7 days
  const NEW_COOLDOWN = 7 * 24 * 60 * 60; // 604800 seconds
  
  console.log("Updating cooldown period...");
  console.log("Contract:", contractAddress);
  console.log("New cooldown:", NEW_COOLDOWN, "seconds (7 days)");
  console.log("");

  const [owner] = await hre.ethers.getSigners();
  console.log("Using account:", owner.address);
  
  // Get contract instance
  const StakingContract = await hre.ethers.getContractFactory("StreetAccessPassStaking");
  const staking = StakingContract.attach(contractAddress);
  
  // Check current cooldown
  const currentCooldown = await staking.getCooldown();
  console.log("Current cooldown:", currentCooldown.toString(), "seconds");
  console.log("");
  
  // Update cooldown
  console.log("Sending transaction...");
  const tx = await staking.setCooldown(NEW_COOLDOWN);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("Transaction confirmed!");
  console.log("");
  
  // Verify new cooldown
  const newCooldown = await staking.getCooldown();
  console.log("New cooldown:", newCooldown.toString(), "seconds");
  console.log("");
  console.log("✅ Cooldown updated successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
