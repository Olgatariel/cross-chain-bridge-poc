const { ethers } = require ("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Вказуємо адресу токена
  const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const Consumer = await ethers.getContractFactory("TokenConsumer");
  const consumer = await Consumer.deploy(tokenAddress);
  await consumer.waitForDeployment();

  console.log("TokenConsumer deployed at:", await consumer.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});