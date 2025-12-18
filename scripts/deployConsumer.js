const { ethers } = require ("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const tokenAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  const Consumer = await ethers.getContractFactory("TokenConsumer");
  const consumer = await Consumer.deploy(tokenAddress);
  await consumer.waitForDeployment();

  console.log("TokenConsumer deployed at:", await consumer.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
