require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

/**
 * Recovery Script: Release Stuck Tokens
 * 
 * This script releases tokens that were burned on Polygon
 * but not yet released on Base due to relayer issues
 */

async function recoverStuckTokens() {
    console.log("🔧 RECOVERY: Releasing Stuck Tokens");
    console.log("=".repeat(60));
    console.log("");

    // Check if diagnostic file exists
    if (!fs.existsSync("stuck-withdrawals.json")) {
        console.error("❌ ERROR: stuck-withdrawals.json not found!");
        console.error("\n📝 Please run diagnostic first:");
        console.error("   node diagnose-stuck-tokens.js");
        process.exit(1);
    }

    // Load stuck withdrawals
    const stuckData = JSON.parse(fs.readFileSync("stuck-withdrawals.json", "utf8"));
    
    console.log("📊 Loaded diagnostic results:");
    console.log(`   Timestamp: ${stuckData.timestamp}`);
    console.log(`   Stuck withdrawals: ${stuckData.stuckCount}`);
    console.log(`   Total amount: ${stuckData.totalStuckAmount} TKN1`);
    console.log("");

    if (stuckData.stuckCount === 0) {
        console.log("✅ No stuck tokens to recover!");
        process.exit(0);
    }

    // Setup
    const providerBase = new ethers.JsonRpcProvider(process.env.RPC_BASE);
    const walletBase = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, providerBase);

    console.log("🔐 Relayer account:", walletBase.address);
    console.log("");

    // Contract
    const TokenConsumerABI = [
        "function release(address to, uint256 amount, uint256 nonce) external",
        "function processedNonces(uint256) view returns (bool)",
        "function relayer() view returns (address)",
        "function getBalance() view returns (uint256)"
    ];

    const tokenConsumer = new ethers.Contract(
        process.env.TOKEN_CONSUMER_ADDRESS,
        TokenConsumerABI,
        walletBase
    );

    try {
        // Verify relayer permissions
        console.log("🔍 Verifying permissions...");
        const currentRelayer = await tokenConsumer.relayer();
        
        if (currentRelayer.toLowerCase() !== walletBase.address.toLowerCase()) {
            console.error(`❌ ERROR: You are not the relayer!`);
            console.error(`   Current relayer: ${currentRelayer}`);
            console.error(`   Your address: ${walletBase.address}`);
            console.error("\n📝 To fix this, run:");
            console.error("   node scripts/change-relayer.js --network baseSepolia");
            process.exit(1);
        }
        console.log("✅ Relayer permissions verified");
        console.log("");

        // Check contract balance
        const contractBalance = await tokenConsumer.getBalance();
        const totalNeeded = ethers.parseEther(stuckData.totalStuckAmount);
        
        console.log("💰 TokenConsumer balance:", ethers.formatEther(contractBalance), "TKN1");
        console.log("💰 Total needed:", ethers.formatEther(totalNeeded), "TKN1");
        
        if (contractBalance < totalNeeded) {
            console.error("\n⚠️  WARNING: Insufficient balance in TokenConsumer!");
            console.error("   Cannot release all stuck tokens.");
            console.error("\n   Options:");
            console.error("   1. Deposit more TKN1 to TokenConsumer");
            console.error("   2. Recover partial amounts");
        }
        console.log("");

        // Process each stuck withdrawal
        console.log("🔧 Starting recovery process...");
        console.log("=".repeat(60));
        console.log("");

        let successCount = 0;
        let failCount = 0;
        let totalRecovered = 0n;

        for (const withdrawal of stuckData.withdrawals) {
            const nonce = BigInt(withdrawal.nonce);
            const amount = ethers.parseEther(withdrawal.amount);
            
            console.log(`\n📦 Processing withdrawal #${withdrawal.nonce}`);
            console.log(`   User: ${withdrawal.user}`);
            console.log(`   Amount: ${withdrawal.amount} TKN1`);
            console.log(`   Original TX: ${withdrawal.txHash}`);

            try {
                // Double check not already processed
                const isProcessed = await tokenConsumer.processedNonces(nonce);
                
                if (isProcessed) {
                    console.log(`   ⏭️  Already processed, skipping...`);
                    successCount++;
                    continue;
                }

                // Execute release
                console.log(`   🔄 Calling release()...`);
                const tx = await tokenConsumer.release(
                    withdrawal.user,
                    amount,
                    nonce,
                    {
                        gasLimit: 100000 // Set explicit gas limit
                    }
                );

                console.log(`   📤 Transaction sent: ${tx.hash}`);
                console.log(`   ⏳ Waiting for confirmation...`);

                const receipt = await tx.wait();
                
                console.log(`   ✅ SUCCESS! Confirmed in block ${receipt.blockNumber}`);
                console.log(`   💰 Released ${withdrawal.amount} TKN1 to ${withdrawal.user}`);
                
                successCount++;
                totalRecovered += amount;

                // Wait a bit between transactions
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`   ❌ FAILED: ${error.message}`);
                
                if (error.message.includes("AlreadyProcessed")) {
                    console.log(`   ℹ️  Nonce already processed (race condition)`);
                    successCount++;
                } else if (error.message.includes("NotRelayer")) {
                    console.error(`   ❌ CRITICAL: Not authorized as relayer!`);
                    process.exit(1);
                } else {
                    failCount++;
                }
            }
        }

        // Summary
        console.log("");
        console.log("=".repeat(60));
        console.log("📊 RECOVERY SUMMARY:");
        console.log("=".repeat(60));
        console.log(`Total withdrawals: ${stuckData.stuckCount}`);
        console.log(`✅ Successfully recovered: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log(`💰 Total amount recovered: ${ethers.formatEther(totalRecovered)} TKN1`);
        console.log("=".repeat(60));

        if (successCount === stuckData.stuckCount) {
            console.log("\n🎉 All stuck tokens recovered successfully!");
            
            // Rename the file to mark as completed
            fs.renameSync(
                "stuck-withdrawals.json",
                `stuck-withdrawals-recovered-${Date.now()}.json`
            );
        } else if (failCount > 0) {
            console.log("\n⚠️  Some tokens could not be recovered.");
            console.log("   Check error messages above for details.");
        }

    } catch (error) {
        console.error("\n❌ Recovery error:", error.message);
        if (error.error) {
            console.error("Details:", error.error);
        }
        process.exit(1);
    }
}

recoverStuckTokens().catch(console.error);