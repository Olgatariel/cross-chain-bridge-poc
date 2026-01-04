const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Setting up/updating bridge configuration...");
  console.log("Note: Relayer is set during deployment. Use this script to update configuration.");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Configuring with account:", deployer.address);
  
  // Load deployment addresses
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  
  const baseDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "base.json"), "utf8")
  );
  
  const polygonDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, "polygon.json"), "utf8")
  );
  
  console.log("\n Loaded deployments:");
  console.log("Base TokenConsumer:", baseDeployment.contracts.TokenConsumer);
  console.log("Polygon BridgeMintBurn:", polygonDeployment.contracts.BridgeMintBurn);
  
  // Get relayer address from environment or use deployer
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  console.log("\n Relayer address:", relayerAddress);
  
  // Configure Base chain
  console.log("\n1. Configuring Base chain...");
  const tokenConsumer = await hre.ethers.getContractAt(
    "TokenConsumer",
    baseDeployment.contracts.TokenConsumer
  );
  
  const currentRelayer = await tokenConsumer.relayer();
  if (currentRelayer === hre.ethers.ZeroAddress || currentRelayer !== relayerAddress) {
    console.log("Setting relayer on TokenConsumer...");
    const tx1 = await tokenConsumer.setRelayer(relayerAddress);
    await tx1.wait();
    console.log(" Relayer set on Base");
  } else {
    console.log(" Relayer already configured on Base");
  }
  
  // Configure Polygon chain
  console.log("\n2. Configuring Polygon chain...");
  const bridgeMintBurn = await hre.ethers.getContractAt(
    "BridgeMintBurn",
    polygonDeployment.contracts.BridgeMintBurn
  );
  
  const BRIDGE_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BRIDGE_ROLE"));
  const hasRole = await bridgeMintBurn.hasRole(BRIDGE_ROLE, relayerAddress);
  
  if (!hasRole) {
    console.log("Granting BRIDGE_ROLE to relayer on BridgeMintBurn...");
    const tx2 = await bridgeMintBurn.grantRole(BRIDGE_ROLE, relayerAddress);
    await tx2.wait();
    console.log(" BRIDGE_ROLE granted on Polygon");
  } else {
    console.log(" BRIDGE_ROLE already granted on Polygon");
  }
  
  // Save bridge configuration
  const bridgeConfig = {
    relayer: relayerAddress,
    base: {
      network: "base",
      tokenConsumer: baseDeployment.contracts.TokenConsumer,
      token1: baseDeployment.contracts.Token1
    },
    polygon: {
      network: "polygon",
      bridgeMintBurn: polygonDeployment.contracts.BridgeMintBurn,
      wrappedToken1: polygonDeployment.contracts.WrappedToken1
    },
    configuredAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(deploymentsDir, "bridge-config.json"),
    JSON.stringify(bridgeConfig, null, 2)
  );
  
  console.log("\n Bridge setup complete!");
  console.log("Configuration saved to deployments/bridge-config.json");
  
  console.log("\n Bridge Configuration Summary:");
  console.log("Relayer:", relayerAddress);
  console.log("\nBase Chain:");
  console.log("  Token1:", baseDeployment.contracts.Token1);
  console.log("  TokenConsumer:", baseDeployment.contracts.TokenConsumer);
  console.log("\nPolygon Chain:");
  console.log("  WrappedToken1:", polygonDeployment.contracts.WrappedToken1);
  console.log("  BridgeMintBurn:", polygonDeployment.contracts.BridgeMintBurn);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });