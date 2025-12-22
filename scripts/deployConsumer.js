const { ethers } = require ("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const tokenAddress = "0x46BFEbbb31042ee6b0315612830Bb056Eb2443Af";
  const Consumer = await ethers.getContractFactory("TokenConsumer");
  const consumer = await Consumer.deploy(tokenAddress);
  await consumer.waitForDeployment();

  console.log("TokenConsumer deployed at:", await consumer.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
