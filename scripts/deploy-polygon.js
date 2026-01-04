const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying Polygon chain contracts...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Deploy WrappedToken1
  console.log("\n1. Deploying WrappedToken1...");
  const WrappedToken1 = await hre.ethers.getContractFactory("WrappedToken1");
  const wrappedToken1 = await WrappedToken1.deploy("Wrapped Token1", "wTKN1");
  await wrappedToken1.waitForDeployment();
  
  console.log("WrappedToken1 deployed to:", wrappedToken1.target);
  
  // Deploy BridgeMintBurn
  console.log("\n2. Deploying BridgeMintBurn...");
  const BridgeMintBurn = await hre.ethers.getContractFactory("BridgeMintBurn");
  const bridgeMintBurn = await BridgeMintBurn.deploy(
    wrappedToken1.target,
    deployer.address
  );
  await bridgeMintBurn.waitForDeployment();
  
  console.log("BridgeMintBurn deployed to:", bridgeMintBurn.target);
  
  // Grant BRIDGE_ROLE to BridgeMintBurn contract
  console.log("\n3. Granting BRIDGE_ROLE to BridgeMintBurn...");
  const BRIDGE_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BRIDGE_ROLE"));
  let tx = await wrappedToken1.grantRole(BRIDGE_ROLE, bridgeMintBurn.target);
  await tx.wait();
  
  console.log("BRIDGE_ROLE granted to BridgeMintBurn");
  
  // Define relayer address BEFORE using it
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  console.log("Relayer address:", relayerAddress);
  
  // Grant BRIDGE_ROLE to relayer
  console.log("\n4. Granting BRIDGE_ROLE to relayer...");
  tx = await bridgeMintBurn.grantRole(BRIDGE_ROLE, relayerAddress);
  await tx.wait();
  
  console.log("BRIDGE_ROLE granted to relayer");

  // Revoke BRIDGE_ROLE from deployer (only if deployer has it)
  console.log("\n5. Revoking BRIDGE_ROLE from deployer...");
  const hasRole = await bridgeMintBurn.hasRole(BRIDGE_ROLE, deployer.address);
  if (hasRole) {
    tx = await bridgeMintBurn.revokeRole(BRIDGE_ROLE, deployer.address);
    await tx.wait();
    console.log("BRIDGE_ROLE revoked from deployer");
  } else {
    console.log("Deployer doesn't have BRIDGE_ROLE, skipping revoke");
  }
  
  // Save deployment addresses
  const deploymentData = {
    network: "polygon",
    deployer: deployer.address,
    relayer: relayerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      WrappedToken1: wrappedToken1.target,
      BridgeMintBurn: bridgeMintBurn.target
    }
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "polygon.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log("\n Polygon deployment complete!");
  console.log("Deployment info saved to deployments/polygon.json");
  
  // Verification info
  console.log("\n Contract verification commands:");
  console.log(`npx hardhat verify --network polygon ${wrappedToken1.target} "Wrapped Token1" "wTKN1"`);
  console.log(`npx hardhat verify --network polygon ${bridgeMintBurn.target} ${wrappedToken1.target} ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });