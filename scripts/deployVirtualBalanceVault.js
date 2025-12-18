// scripts/deployVirtualBalanceVault.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer, relayer] = await ethers.getSigners();

  console.log("Deploying contracts with deployer:", deployer.address);
  console.log("Relayer address:", relayer.address);

  const VirtualBalanceVault = await ethers.getContractFactory("VirtualBalanceVault");
  const vault = await VirtualBalanceVault.deploy(relayer.address);
  await vault.waitForDeployment();

  console.log("VirtualBalanceVault deployed at:", await vault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});