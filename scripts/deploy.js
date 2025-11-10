const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);


  const Token = await ethers.getContractFactory("contracts/DeFiEcoSystem/Token.sol:TarToken");
  const token = await Token.deploy("Tar Token", "TAR"); 
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("Token deployed at:", tokenAddress);

  const Treasury = await ethers.getContractFactory("contracts/DeFiEcoSystem/Treasury.sol:Treasury");
  const treasury = await Treasury.deploy(tokenAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury deployed at:", treasuryAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});