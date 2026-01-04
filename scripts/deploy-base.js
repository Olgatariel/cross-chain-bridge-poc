const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Base chain contracts...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Deploy Token1
  console.log("\n1. Deploying Token1...");
  const Token1 = await hre.ethers.getContractFactory("Token1");
  const initialSupply = hre.ethers.parseEther("1000000"); // 1M tokens
  const token1 = await Token1.deploy(initialSupply);
  await token1.waitForDeployment();
  
  console.log("Token1 deployed to:", token1.target);
  
  // Deploy TokenConsumer
  console.log("\n2. Deploying TokenConsumer...");
  const TokenConsumer = await hre.ethers.getContractFactory("TokenConsumer");
  const tokenConsumer = await TokenConsumer.deploy(token1.target);
  await tokenConsumer.waitForDeployment();
  
  console.log("TokenConsumer deployed to:", tokenConsumer.target);
  
  // Set relayer (use env variable or deployer as default)
  console.log("\n3. Setting relayer...");
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  const tx = await tokenConsumer.setRelayer(relayerAddress);
  await tx.wait();
  
  console.log("Relayer set to:", relayerAddress);
  
  // Save deployment addresses
  const deploymentData = {
    network: "base",
    deployer: deployer.address,
    relayer: relayerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      Token1: token1.target,
      TokenConsumer: tokenConsumer.target
    }
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "base.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log("\n Base deployment complete!");
  console.log("Deployment info saved to deployments/base.json");
  
  // Verification info
  console.log("\n Contract verification commands:");
  console.log(`npx hardhat verify --network base ${token1.target} "${initialSupply}"`);
  console.log(`npx hardhat verify --network base ${tokenConsumer.target} ${token1.target}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });