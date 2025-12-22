const { ethers } = require("hardhat");

async function main() {
  
  const [deployer] = await ethers.getSigners();

  console.log("=== Deploying to Polygon Amoy ===");
  console.log("Deployer (will be relayer):", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC");

  const relayerAddress = deployer.address;
  
  console.log("\n--- Deploying VirtualBalanceVault ---");
  console.log("Relayer address:", relayerAddress);

  const VirtualBalanceVault = await ethers.getContractFactory("VirtualBalanceVault");
  const vault = await VirtualBalanceVault.deploy(relayerAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log(" VirtualBalanceVault deployed to:", vaultAddress);
  
  console.log("\nView on explorer:");
  console.log(`https://www.oklink.com/amoy/address/${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});