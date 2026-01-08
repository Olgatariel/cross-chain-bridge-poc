require("dotenv").config();
const { ethers } = require("ethers");
const { submitToAvail } = require("./availHelper");

/**
 * Fresh Start Relayer - No Historical Events
 * 
 * This version starts monitoring from the CURRENT block
 * and ignores all historical events to avoid processing
 * already-completed withdrawals
 */

// RPC Providers
const providerBase = new ethers.JsonRpcProvider(process.env.RPC_BASE);
const providerPolygon = new ethers.JsonRpcProvider(process.env.RPC_POLYGON);

// Relayer wallets
const walletBase = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, providerBase);
const walletPolygon = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, providerPolygon);

// Contract ABIs
const TokenConsumerABI = [
    "event DepositIntent(address indexed user, uint256 amount, uint256 nonce)",
    "function release(address to, uint256 amount, uint256 nonce) external"
];

const BridgeMintBurnABI = [
    "event WithdrawIntent(address indexed user, uint256 amount, uint256 indexed withdrawNonce)",
    "function mintWrapped(address to, uint256 amount, uint256 depositNonce) external"
];

// Contract addresses
const TOKEN_CONSUMER_ADDRESS = process.env.TOKEN_CONSUMER_ADDRESS;
const BRIDGE_MINT_BURN_ADDRESS = process.env.BRIDGE_MINT_BURN_ADDRESS;

// Contract instances
const tokenConsumer = new ethers.Contract(TOKEN_CONSUMER_ADDRESS, TokenConsumerABI, providerBase);
const bridgeMintBurn = new ethers.Contract(BRIDGE_MINT_BURN_ADDRESS, BridgeMintBurnABI, providerPolygon);
const tokenConsumerWithSigner = new ethers.Contract(TOKEN_CONSUMER_ADDRESS, TokenConsumerABI, walletBase);
const bridgeMintBurnWithSigner = new ethers.Contract(BRIDGE_MINT_BURN_ADDRESS, BridgeMintBurnABI, walletPolygon);

// Block tracking - will be initialized to CURRENT block
const MAX_BLOCK_RANGE = 10;
let lastBlockBase = null;
let lastBlockPolygon = null;

// Polling intervals
providerBase.pollingInterval = 3000;
providerPolygon.pollingInterval = 3000;

console.log(" Fresh Start Relayer - No Historical Events");
console.log("=====================================");
console.log("  This relayer ONLY processes NEW events");
console.log("  Historical events are IGNORED");
console.log("");
console.log("Base Chain:");
console.log("  TokenConsumer:", TOKEN_CONSUMER_ADDRESS);
console.log("  Relayer:", walletBase.address);
console.log("");
console.log("Polygon Chain:");
console.log("  BridgeMintBurn:", BRIDGE_MINT_BURN_ADDRESS);
console.log("  Relayer:", walletPolygon.address);
console.log("");
console.log("Avail DA:");
console.log("  AppID:", process.env.AVAIL_APP_ID);
console.log("=====================================\n");

async function checkBaseDeposits() {
    try {
        const currentBlock = await providerBase.getBlockNumber();
        
        // CRITICAL: Initialize to CURRENT block (skip history)
        if (lastBlockBase === null) {
            lastBlockBase = currentBlock;
            console.log(" Connected to Base");
            console.log("   Current block:", currentBlock);
            console.log("    Starting from CURRENT block (no history scan)");
            console.log("   Listening for NEW DepositIntent events...\n");
            return; // Skip first iteration
        }
        
        if (currentBlock > lastBlockBase) {
            const fromBlock = lastBlockBase + 1;
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
            
            const filter = tokenConsumer.filters.DepositIntent();
            const events = await tokenConsumer.queryFilter(filter, fromBlock, toBlock);
            
            if (events.length > 0) {
                console.log(`\n[BASE] Found ${events.length} NEW DepositIntent event(s)`);
                for (const event of events) {
                    await handleBaseToPolygon(event);
                }
            }
            
            lastBlockBase = toBlock;
        }
    } catch (error) {
        if (!error.message.includes("block range")) {
            console.error("Error checking Base events:", error.message);
        }
    }
}

async function handleBaseToPolygon(event) {
    const { user, amount, nonce } = event.args;
    
    console.log("\n=======================================");
    console.log(" BASE -> POLYGON DEPOSIT DETECTED");
    console.log("=======================================");
    console.log("User:", user);
    console.log("Amount:", ethers.formatEther(amount), "tokens");
    console.log("Nonce:", nonce.toString());
    console.log("Block:", event.blockNumber);
    console.log("Transaction:", event.transactionHash);
    
    try {
        console.log("\nStep 1: Publishing to Avail DA...");
        const availResult = await submitToAvail(user, amount, nonce, "base_to_polygon");
        console.log(" Avail confirmation received");
        console.log("   Block:", availResult.blockNumber);
        console.log("   Data Hash:", availResult.dataHash);
        
        console.log("\nStep 2: Minting wrapped tokens on Polygon...");
        const tx = await bridgeMintBurnWithSigner.mintWrapped(user, amount, nonce);
        console.log("   Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("   Confirmed in block:", receipt.blockNumber);
        
        console.log("\n SUCCESS: Bridge completed");
        console.log("   Amount:", ethers.formatEther(amount), "wTKN1");
        console.log("   Recipient:", user);
        console.log("   Avail Block:", availResult.blockNumber);
        console.log("=======================================\n");
        
    } catch (err) {
        console.error("\n ERROR during Base->Polygon bridge:");
        console.error("   Message:", err.message);
        console.error("=======================================\n");
    }
}

async function checkPolygonWithdrawals() {
    try {
        const currentBlock = await providerPolygon.getBlockNumber();
        
        // CRITICAL: Initialize to CURRENT block (skip history)
        if (lastBlockPolygon === null) {
            lastBlockPolygon = currentBlock;
            console.log(" Connected to Polygon");
            console.log("   Current block:", currentBlock);
            console.log("   Starting from CURRENT block (no history scan)");
            console.log("   Listening for NEW WithdrawIntent events...\n");
            return; // Skip first iteration
        }
        
        if (currentBlock > lastBlockPolygon) {
            const fromBlock = lastBlockPolygon + 1;
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
            
            const filter = bridgeMintBurn.filters.WithdrawIntent();
            const events = await bridgeMintBurn.queryFilter(filter, fromBlock, toBlock);
            
            if (events.length > 0) {
                console.log(`\n[POLYGON] Found ${events.length} NEW WithdrawIntent event(s)`);
                for (const event of events) {
                    await handlePolygonToBase(event);
                }
            }
            
            lastBlockPolygon = toBlock;
        }
    } catch (error) {
        if (!error.message.includes("block range")) {
            console.error("Error checking Polygon events:", error.message);
        }
    }
}

async function handlePolygonToBase(event) {
    const { user, amount, withdrawNonce } = event.args;
    
    console.log("\n=======================================");
    console.log(" POLYGON -> BASE WITHDRAWAL DETECTED");
    console.log("=======================================");
    console.log("User:", user);
    console.log("Amount:", ethers.formatEther(amount), "tokens");
    console.log("Withdraw Nonce:", withdrawNonce.toString());
    console.log("Block:", event.blockNumber);
    console.log("Transaction:", event.transactionHash);
    
    try {
        console.log("\nStep 1: Publishing to Avail DA...");
        const availResult = await submitToAvail(
            user, 
            amount, 
            withdrawNonce, 
            "polygon_to_base"
        );
        console.log(" Avail confirmation received");
        console.log("   Block:", availResult.blockNumber);
        console.log("   Data Hash:", availResult.dataHash);
        
        console.log("\nStep 2: Releasing original tokens on Base...");
        const tx = await tokenConsumerWithSigner.release(user, amount, withdrawNonce);
        console.log("   Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("   Confirmed in block:", receipt.blockNumber);
        
        console.log("\n SUCCESS: Bridge completed");
        console.log("   Amount:", ethers.formatEther(amount), "TKN1");
        console.log("   Recipient:", user);
        console.log("   Avail Block:", availResult.blockNumber);
        console.log("=======================================\n");
        
    } catch (err) {
        console.error("\n ERROR during Polygon->Base bridge:");
        console.error("   Message:", err.message);
        
        // Provide helpful error messages
        if (err.message.includes("AlreadyProcessed")) {
            console.error("     This nonce was already processed (possibly by another relayer instance)");
        } else if (err.message.includes("NotRelayer")) {
            console.error("     Relayer permissions issue - check relayer address");
        }
        
        console.error("=======================================\n");
    }
}

console.log(" Starting event listeners (Fresh Start Mode)...\n");

setInterval(async () => {
    await checkBaseDeposits();
    await checkPolygonWithdrawals();
}, 3000);

checkBaseDeposits();
checkPolygonWithdrawals();

process.on('SIGINT', () => {
    console.log('\n\n Relayer shutting down...');
    process.exit(0);
});