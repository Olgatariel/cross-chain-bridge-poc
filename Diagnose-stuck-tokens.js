require("dotenv").config();
const { ethers } = require("ethers");

/**
 * Diagnostic Script: Find Stuck Bridge Transactions
 * 
 * This script identifies withdrawals that were burned on Polygon
 * but not yet released on Base (stuck tokens)
 */

async function diagnoseStuckTokens() {
    console.log("🔍 DIAGNOSTIC: Finding Stuck Bridge Transactions");
    console.log("=".repeat(60));
    console.log("");

    // Setup providers
    const providerBase = new ethers.JsonRpcProvider(process.env.RPC_BASE);
    const providerPolygon = new ethers.JsonRpcProvider(process.env.RPC_POLYGON);

    const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || (new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY)).address;

    // Contract ABIs
    const TokenConsumerABI = [
        "event ReleaseExecuted(address indexed user, uint256 amount, uint256 nonce)",
        "function processedNonces(uint256) view returns (bool)",
        "function getBalance() view returns (uint256)"
    ];

    const BridgeMintBurnABI = [
        "event WithdrawIntent(address indexed user, uint256 amount, uint256 indexed withdrawNonce)",
        "function withdrawNonce() view returns (uint256)"
    ];

    // Contracts
    const tokenConsumer = new ethers.Contract(
        process.env.TOKEN_CONSUMER_ADDRESS,
        TokenConsumerABI,
        providerBase
    );

    const bridgeMintBurn = new ethers.Contract(
        process.env.BRIDGE_MINT_BURN_ADDRESS,
        BridgeMintBurnABI,
        providerPolygon
    );

    try {
        // Step 1: Get all WithdrawIntent events from Polygon
        console.log("📊 Step 1: Scanning Polygon for WithdrawIntent events...");
        const withdrawFilter = bridgeMintBurn.filters.WithdrawIntent();
        const withdrawEvents = await bridgeMintBurn.queryFilter(withdrawFilter, -50000); // Last ~50k blocks
        
        console.log(`   Found ${withdrawEvents.length} withdrawal events\n`);

        // Step 2: Get all ReleaseExecuted events from Base
        console.log("📊 Step 2: Scanning Base for ReleaseExecuted events...");
        const releaseFilter = tokenConsumer.filters.ReleaseExecuted();
        const releaseEvents = await tokenConsumer.queryFilter(releaseFilter, -50000);
        
        console.log(`   Found ${releaseEvents.length} release events\n`);

        // Step 3: Create sets for quick lookup
        const releasedNonces = new Set(
            releaseEvents.map(e => e.args.nonce.toString())
        );

        // Step 4: Find stuck withdrawals
        console.log("🔍 Step 3: Identifying stuck transactions...\n");
        console.log("=".repeat(60));

        const stuckWithdrawals = [];
        let totalStuckAmount = 0n;

        for (const event of withdrawEvents) {
            const { user, amount, withdrawNonce } = event.args;
            const nonceStr = withdrawNonce.toString();
            
            // Check if this nonce was released on Base
            const wasReleased = releasedNonces.has(nonceStr);
            const isProcessed = await tokenConsumer.processedNonces(withdrawNonce);

            if (!wasReleased && !isProcessed) {
                // This withdrawal was burned on Polygon but not released on Base!
                const block = await event.getBlock();
                
                stuckWithdrawals.push({
                    user,
                    amount,
                    nonce: withdrawNonce,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    timestamp: block.timestamp
                });

                totalStuckAmount += amount;

                console.log(`❌ STUCK WITHDRAWAL #${nonceStr}`);
                console.log(`   User: ${user}`);
                console.log(`   Amount: ${ethers.formatEther(amount)} TKN1`);
                console.log(`   Polygon TX: ${event.transactionHash}`);
                console.log(`   Block: ${event.blockNumber}`);
                console.log(`   Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
                console.log(`   Status: Burned on Polygon ✅ | Released on Base ❌`);
                console.log("");
            } else if (wasReleased || isProcessed) {
                console.log(`✅ Withdrawal #${nonceStr}: Successfully completed`);
            }
        }

        console.log("=".repeat(60));
        console.log("\n📊 SUMMARY:");
        console.log("=".repeat(60));
        console.log(`Total withdrawals: ${withdrawEvents.length}`);
        console.log(`Completed: ${withdrawEvents.length - stuckWithdrawals.length}`);
        console.log(`Stuck: ${stuckWithdrawals.length}`);
        console.log(`Total stuck amount: ${ethers.formatEther(totalStuckAmount)} TKN1`);
        console.log("");

        // Check TokenConsumer balance
        const contractBalance = await tokenConsumer.getBalance();
        console.log(`TokenConsumer balance: ${ethers.formatEther(contractBalance)} TKN1`);
        
        if (contractBalance >= totalStuckAmount) {
            console.log(`✅ Sufficient balance to release all stuck tokens`);
        } else {
            console.log(`⚠️  WARNING: Insufficient balance! Need ${ethers.formatEther(totalStuckAmount - contractBalance)} more TKN1`);
        }

        console.log("=".repeat(60));

        // Save results
        if (stuckWithdrawals.length > 0) {
            const fs = require("fs");
            const results = {
                timestamp: new Date().toISOString(),
                relayerAddress: RELAYER_ADDRESS,
                stuckCount: stuckWithdrawals.length,
                totalStuckAmount: ethers.formatEther(totalStuckAmount),
                contractBalance: ethers.formatEther(contractBalance),
                withdrawals: stuckWithdrawals.map(w => ({
                    user: w.user,
                    amount: ethers.formatEther(w.amount),
                    nonce: w.nonce.toString(),
                    txHash: w.txHash,
                    blockNumber: w.blockNumber,
                    timestamp: new Date(w.timestamp * 1000).toISOString()
                }))
            };

            fs.writeFileSync(
                "stuck-withdrawals.json",
                JSON.stringify(results, null, 2)
            );

            console.log("\n💾 Results saved to: stuck-withdrawals.json");
            console.log("\n🔧 To recover these tokens, run:");
            console.log("   node recover-stuck-tokens.js");
        } else {
            console.log("\n✅ No stuck tokens found! Everything is working correctly.");
        }

        console.log("=".repeat(60));

    } catch (error) {
        console.error("\n❌ Error during diagnosis:", error.message);
        if (error.error) {
            console.error("Details:", error.error);
        }
    }
}

diagnoseStuckTokens().catch(console.error);
