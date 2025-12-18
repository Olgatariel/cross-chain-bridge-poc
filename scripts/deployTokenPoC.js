const { ethers } = require("hardhat");

async function main() {
  const Token = await ethers.getContractFactory("Token1");
  const token = await Token.deploy(ethers.parseEther("1000"));
  await token.waitForDeployment();

  console.log("Token deployed to:", token.target);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});