const {ethers} = require("hardhat");

async function main() {
    const Token = await ethers.getContractFactory("Token1");

    const initialSupply = ethers.parseUnits("1000", 18);
    const token = await Token.deploy(initialSupply);

    await token.waitForDeployment();
    console.log("Token deployed to:", token.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
