const { ethers } = require("hardhat");

async function main() {
    const [user] = await ethers.getSigners();

    console.log("=== Testing Bridge POC ===");
    console.log("User address:", user.address);

    // Connect to deployed contracts on Base Sepolia
    const tokenAddress = "0x46BFEbbb31042ee6b0315612830Bb056Eb2443Af"; 
    const consumerAddress = "0x787f3F838a126491F651207Bb575E07D9a95Da5b";

    const token = await ethers.getContractAt("Token1", tokenAddress);
    const consumer = await ethers.getContractAt("TokenConsumer", consumerAddress);

    const balanceBefore = await token.balanceOf(user.address);
    console.log("\nToken balance before:", ethers.formatEther(balanceBefore), "TKN1");

    const depositAmount = ethers.parseEther("5");
    const destinationChainId = 80002; // Polygon Amoy

    // Step 1: Approve tokens for bridge contract
    console.log("\n--- Approving tokens ---");
    const approveTx = await token.approve(consumerAddress, depositAmount);
    await approveTx.wait();
    console.log("✓ Approved", ethers.formatEther(depositAmount), "tokens");

    // Step 2: Lock tokens and emit event for relayer
    console.log("\n--- Depositing to Bridge ---");
    const depositTx = await consumer.deposit(depositAmount, destinationChainId, {
        gasLimit: 500000  // Explicit gas limit for testnet reliability
    });
    console.log("Transaction sent:", depositTx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await depositTx.wait();
    console.log("✓ Deposit confirmed in block:", receipt.blockNumber);

    // Parse DepositIntent event for verification
    const event = receipt.logs.find(log => {
        try {
            return consumer.interface.parseLog(log).name === "DepositIntent";
        } catch {
            return false;
        }
    });

    if (event) {
        const parsed = consumer.interface.parseLog(event);
        console.log("\n📢 DepositIntent Event Emitted:");
        console.log("  User:", parsed.args.user);
        console.log("  Amount:", ethers.formatEther(parsed.args.amount));
        console.log("  Destination Chain:", parsed.args.destinationChainId.toString());
    }

    // Display final balances
    const balanceAfter = await token.balanceOf(user.address);
    const consumerBalance = await token.balanceOf(consumerAddress);
    
    console.log("\n=== Results ===");
    console.log("User balance after:", ethers.formatEther(balanceAfter), "TKN1");
    console.log("Consumer contract balance:", ethers.formatEther(consumerBalance), "TKN1");
    
    console.log("\n Check RELAYER terminal!");
    console.log("   Relayer should automatically credit on Polygon Amoy");
    console.log("\nView on explorer:");
    console.log(`https://sepolia.basescan.org/tx/${receipt.hash}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});