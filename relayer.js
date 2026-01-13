require("dotenv").config();
const { ethers } = require("ethers");
const { submitToAvail } = require("./availHelper");
const fs = require('fs');
const path = require('path');

/**
 * Bidirectional Bridge Relayer with State Persistence
 * 
 * Improvements:
 * - Checks if deposits/withdrawals already processed before executing
 * - Saves last processed block to avoid re-scanning after restart
 * - Better error handling for duplicate transactions
 */

// State file for persistence
const STATE_FILE = path.join(__dirname, 'relayer-state.json');

// Load saved state
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            const state = JSON.parse(data);
            console.log('📂 Loaded saved state:', state);
            return state;
        }
    } catch (error) {
        console.log('⚠️  Could not load state, starting fresh');
    }
    return { lastBlockBase: 0, lastBlockPolygon: 0 };
}

// Save state
function saveState() {
    try {
        const state = {
            lastBlockBase,
            lastBlockPolygon,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('❌ Could not save state:', error.message);
    }
}

// RPC Providers
const providerBase = new ethers.JsonRpcProvider(process.env.RPC_BASE);
const providerPolygon = new ethers.JsonRpcProvider(process.env.RPC_POLYGON);

// Relayer wallets
const walletBase = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, providerBase);
const walletPolygon = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, providerPolygon);

// Contract ABIs
const TokenConsumerABI = [
    "event DepositIntent(address indexed user, uint256 amount, uint256 nonce)",
    "function release(address to, uint256 amount, uint256 nonce) external",
    "function processedNonces(uint256) view returns (bool)"
];

const BridgeMintBurnABI = [
    "event WithdrawIntent(address indexed user, uint256 amount, uint256 indexed withdrawNonce)",
    "function mintWrapped(address to, uint256 amount, uint256 depositNonce) external",
    "function processedDeposits(uint256) view returns (bool)"
];

// Contract addresses
const TOKEN_CONSUMER_ADDRESS = process.env.TOKEN_CONSUMER_ADDRESS;
const BRIDGE_MINT_BURN_ADDRESS = process.env.BRIDGE_MINT_BURN_ADDRESS;

// Contract instances for reading
const tokenConsumer = new ethers.Contract(
    TOKEN_CONSUMER_ADDRESS, 
    TokenConsumerABI, 
    providerBase
);

const bridgeMintBurn = new ethers.Contract(
    BRIDGE_MINT_BURN_ADDRESS,
    BridgeMintBurnABI,
    providerPolygon
);

// Contract instances for writing
const tokenConsumerWithSigner = new ethers.Contract(
    TOKEN_CONSUMER_ADDRESS,
    TokenConsumerABI,
    walletBase
);

const bridgeMintBurnWithSigner = new ethers.Contract(
    BRIDGE_MINT_BURN_ADDRESS,
    BridgeMintBurnABI,
    walletPolygon
);

// Block tracking - load from saved state
const savedState = loadState();
const MAX_BLOCK_RANGE = 10;
let lastBlockBase = savedState.lastBlockBase || 0;
let lastBlockPolygon = savedState.lastBlockPolygon || 0;

// Polling intervals
providerBase.pollingInterval = 3000;
providerPolygon.pollingInterval = 3000;

// Startup logs
console.log("🌉 Bidirectional Bridge Relayer Started");
console.log("=====================================");
console.log("Base Chain:");
console.log("  TokenConsumer:", TOKEN_CONSUMER_ADDRESS);
console.log("  Relayer:", walletBase.address);
console.log("\nPolygon Chain:");
console.log("  BridgeMintBurn:", BRIDGE_MINT_BURN_ADDRESS);
console.log("  Relayer:", walletPolygon.address);
console.log("\nAvail DA:");
console.log("  AppID:", process.env.AVAIL_APP_ID);
console.log("=====================================\n");

/**
 * Check Base chain for deposit events
 */
async function checkBaseDeposits() {
    try {
        const currentBlock = await providerBase.getBlockNumber();
        
        if (lastBlockBase === 0) {
            lastBlockBase = currentBlock - 50;
            console.log("🔗 Connected to Base. Current block:", currentBlock);
            console.log("📍 Starting from block:", lastBlockBase);
            console.log("👂 Listening for Base DepositIntent events...\n");
        }
        
        if (currentBlock > lastBlockBase) {
            const fromBlock = lastBlockBase + 1;
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
            
            const filter = tokenConsumer.filters.DepositIntent();
            const events = await tokenConsumer.queryFilter(filter, fromBlock, toBlock);
            
            if (events.length > 0) {
                console.log(`\n[BASE] Found ${events.length} DepositIntent event(s)`);
                
                for (const event of events) {
                    await handleBaseToPolygon(event);
                }
            }
            
            lastBlockBase = toBlock;
        }
    } catch (error) {
        if (!error.message.includes("block range")) {
            console.error("❌ Error checking Base events:", error.message);
        }
    }
}

/**
 * Process Base -> Polygon deposit
 */
async function handleBaseToPolygon(event) {
    const { user, amount, nonce } = event.args;
    
    console.log("\n=======================================");
    console.log("📥 BASE -> POLYGON DEPOSIT DETECTED");
    console.log("=======================================");
    console.log("User:", user);
    console.log("Amount:", ethers.formatEther(amount), "tokens");
    console.log("Nonce:", nonce.toString());
    console.log("Block:", event.blockNumber);
    console.log("Transaction:", event.transactionHash);
    
    try {
        // CHECK IF ALREADY PROCESSED
        const isProcessed = await bridgeMintBurnWithSigner.processedDeposits(nonce);
        
        if (isProcessed) {
            console.log("\n⏭️  Deposit already processed, skipping...");
            console.log("=======================================\n");
            return;
        }
        
        // Step 1: Submit to Avail DA
        console.log("\nStep 1: Publishing to Avail DA...");
        const availResult = await submitToAvail(user, amount, nonce, "base_to_polygon");
        console.log("✓ Avail confirmation received");
        console.log("  Block:", availResult.blockNumber);
        console.log("  Data Hash:", availResult.dataHash);
        
        // Step 2: Mint wrapped tokens on Polygon
        console.log("\nStep 2: Minting wrapped tokens on Polygon...");
        const tx = await bridgeMintBurnWithSigner.mintWrapped(user, amount, nonce);
        console.log("  Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("  Confirmed in block:", receipt.blockNumber);
        
        console.log("\n✅ SUCCESS: Bridge completed");
        console.log("  Amount:", ethers.formatEther(amount), "wTKN1");
        console.log("  Recipient:", user);
        console.log("  Avail Block:", availResult.blockNumber);
        console.log("=======================================\n");
        
    } catch (err) {
        console.error("\n❌ ERROR during Base->Polygon bridge:");
        console.error("  Message:", err.message);
        
        if (err.message.includes("already processed")) {
            console.log("  (This is expected for duplicate events)");
        }
        
        console.error("=======================================\n");
    }
}

/**
 * Check Polygon chain for withdrawal events
 */
async function checkPolygonWithdrawals() {
    try {
        const currentBlock = await providerPolygon.getBlockNumber();
        
        if (lastBlockPolygon === 0) {
            lastBlockPolygon = currentBlock - 50;
            console.log("🔗 Connected to Polygon. Current block:", currentBlock);
            console.log("📍 Starting from block:", lastBlockPolygon);
            console.log("👂 Listening for Polygon WithdrawIntent events...\n");
        }
        
        if (currentBlock > lastBlockPolygon) {
            const fromBlock = lastBlockPolygon + 1;
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
            
            const filter = bridgeMintBurn.filters.WithdrawIntent();
            const events = await bridgeMintBurn.queryFilter(filter, fromBlock, toBlock);
            
            if (events.length > 0) {
                console.log(`\n[POLYGON] Found ${events.length} WithdrawIntent event(s)`);
                
                for (const event of events) {
                    await handlePolygonToBase(event);
                }
            }
            
            lastBlockPolygon = toBlock;
        }
    } catch (error) {
        if (!error.message.includes("block range")) {
            console.error("❌ Error checking Polygon events:", error.message);
        }
    }
}

/**
 * Process Polygon -> Base withdrawal
 */
async function handlePolygonToBase(event) {
    const { user, amount, withdrawNonce } = event.args;
    
    console.log("\n=======================================");
    console.log("📤 POLYGON -> BASE WITHDRAWAL DETECTED");
    console.log("=======================================");
    console.log("User:", user);
    console.log("Amount:", ethers.formatEther(amount), "tokens");
    console.log("Withdraw Nonce:", withdrawNonce.toString());
    console.log("Block:", event.blockNumber);
    console.log("Transaction:", event.transactionHash);
    
    try {
        // CHECK IF ALREADY PROCESSED
        const isProcessed = await tokenConsumerWithSigner.processedNonces(withdrawNonce);
        
        if (isProcessed) {
            console.log("\n⏭️  Withdrawal already processed, skipping...");
            console.log("=======================================\n");
            return;
        }
        
        // Step 1: Submit to Avail DA
        console.log("\nStep 1: Publishing to Avail DA...");
        const availResult = await submitToAvail(
            user, 
            amount, 
            withdrawNonce, 
            "polygon_to_base"
        );
        console.log("✓ Avail confirmation received");
        console.log("  Block:", availResult.blockNumber);
        console.log("  Data Hash:", availResult.dataHash);
        
        // Step 2: Release original tokens on Base
        console.log("\nStep 2: Releasing original tokens on Base...");
        const tx = await tokenConsumerWithSigner.release(user, amount, withdrawNonce);
        console.log("  Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("  Confirmed in block:", receipt.blockNumber);
        
        console.log("\n✅ SUCCESS: Bridge completed");
        console.log("  Amount:", ethers.formatEther(amount), "TKN1");
        console.log("  Recipient:", user);
        console.log("  Avail Block:", availResult.blockNumber);
        console.log("=======================================\n");
        
    } catch (err) {
        console.error("\n❌ ERROR during Polygon->Base bridge:");
        console.error("  Message:", err.message);
        
        if (err.message.includes("AlreadyProcessed")) {
            console.log("  (This is expected for duplicate events)");
        }
        
        console.error("=======================================\n");
    }
}

// Save state periodically
setInterval(saveState, 10000);

// Save state on shutdown
process.on('SIGINT', () => {
    console.log('\n\n💾 Saving state before shutdown...');
    saveState();
    console.log('👋 Relayer shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n💾 Saving state before shutdown...');
    saveState();
    console.log('👋 Relayer shutting down...');
    process.exit(0);
});

// Start event listeners
console.log("🚀 Starting event listeners...\n");

setInterval(async () => {
    await checkBaseDeposits();
    await checkPolygonWithdrawals();
}, 3000);

// Run initial checks
checkBaseDeposits();
checkPolygonWithdrawals();