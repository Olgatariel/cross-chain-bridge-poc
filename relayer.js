require("dotenv").config();
const { ethers } = require("ethers");
const { submitToAvail } = require("./availHelper");

/**
 * Bidirectional Bridge Relayer
 * 
 * Monitors two chains for bridge events and processes cross-chain transfers:
 * - Base -> Polygon: Listens for DepositIntent, mints wrapped tokens
 * - Polygon -> Base: Listens for WithdrawIntent, releases original tokens
 * 
 * Data availability is ensured through Avail DA layer before executing transfers
 */

// RPC Providers
const providerBase = new ethers.JsonRpcProvider(process.env.RPC_BASE);
const providerPolygon = new ethers.JsonRpcProvider(process.env.RPC_POLYGON);

// Relayer wallets (same private key, different providers)
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

// Contract addresses from environment
const TOKEN_CONSUMER_ADDRESS = process.env.TOKEN_CONSUMER_ADDRESS;
const BRIDGE_MINT_BURN_ADDRESS = process.env.BRIDGE_MINT_BURN_ADDRESS;

// Contract instances for reading events
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

// Contract instances for writing transactions
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

// Block tracking for event polling
const MAX_BLOCK_RANGE = 10;
let lastBlockBase = 0;
let lastBlockPolygon = 0;

// START FROM CURRENT BLOCK (avoid processing old events)
const START_FROM_CURRENT = process.env.START_FROM_CURRENT === 'true';

// Cache to prevent duplicate processing (in-memory)
const processedDepositNonces = new Set();
const processedWithdrawNonces = new Set();

// Polling intervals (milliseconds)
providerBase.pollingInterval = 3000;
providerPolygon.pollingInterval = 3000;

// Startup logs
console.log("Bidirectional Bridge Relayer Started");
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
 * Scans new blocks and processes DepositIntent events
 */
async function checkBaseDeposits() {
    try {
        const currentBlock = await providerBase.getBlockNumber();
        
        // Initialize starting block on first run
        if (lastBlockBase === 0) {
            // If START_FROM_CURRENT is true, skip historical events
            if (START_FROM_CURRENT) {
                lastBlockBase = currentBlock;
                console.log("Connected to Base. Current block:", currentBlock);
                console.log("  START_FROM_CURRENT enabled - skipping historical events");
                console.log("Starting from block:", lastBlockBase);
            } else {
                lastBlockBase = currentBlock - 50;
                console.log("Connected to Base. Current block:", currentBlock);
                console.log("Starting from block:", lastBlockBase);
            }
            console.log("Listening for Base DepositIntent events...\n");
        }
        
        if (currentBlock > lastBlockBase) {
            const fromBlock = lastBlockBase + 1;
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
            
            const filter = tokenConsumer.filters.DepositIntent();
            const events = await tokenConsumer.queryFilter(filter, fromBlock, toBlock);
            
            if (events.length > 0) {
                console.log("\n[BASE] Found", events.length, "DepositIntent event(s)");
                
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

/**
 * Process Base -> Polygon deposit
 * 1. Submit data to Avail DA
 * 2. Mint wrapped tokens on Polygon
 */
async function handleBaseToPolygon(event) {
    const { user, amount, nonce } = event.args;
    
    // Skip if already processed in memory
    const nonceStr = nonce.toString();
    if (processedDepositNonces.has(nonceStr)) {
        console.log(`  Skipping deposit nonce ${nonceStr} - already processed`);
        return;
    }
    
    // Check if already processed on blockchain
    try {
        const isProcessed = await bridgeMintBurn.processedDeposits(nonce);
        if (isProcessed) {
            console.log(`  Skipping deposit nonce ${nonceStr} - already processed on Polygon blockchain`);
            processedDepositNonces.add(nonceStr); // Add to cache
            return;
        }
    } catch (err) {
        console.error(`  Could not check nonce ${nonceStr} status:`, err.message);
    }
    
    console.log("\n=======================================");
    console.log("BASE -> POLYGON DEPOSIT DETECTED");
    console.log("=======================================");
    console.log("User:", user);
    console.log("Amount:", ethers.formatEther(amount), "tokens");
    console.log("Nonce:", nonce.toString());
    console.log("Block:", event.blockNumber);
    console.log("Transaction:", event.transactionHash);
    
    try {
        // Step 1: Submit to Avail DA for data availability proof
        console.log("\nStep 1: Publishing to Avail DA...");
        const availResult = await submitToAvail(user, amount, nonce, "base_to_polygon");
        console.log("Avail confirmation received");
        console.log("  Block:", availResult.blockNumber);
        console.log("  Data Hash:", availResult.dataHash);
        
        // Step 2: Mint wrapped tokens on Polygon
        console.log("\nStep 2: Minting wrapped tokens on Polygon...");
        const tx = await bridgeMintBurnWithSigner.mintWrapped(user, amount, nonce);
        console.log("  Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("  Confirmed in block:", receipt.blockNumber);
        
        // Mark as processed
        processedDepositNonces.add(nonceStr);
        
        console.log("\nSUCCESS: Bridge completed");
        console.log("  Amount:", ethers.formatEther(amount), "wTKN1");
        console.log("  Recipient:", user);
        console.log("  Avail Block:", availResult.blockNumber);
        console.log("=======================================\n");
        
    } catch (err) {
        console.error("\nERROR during Base->Polygon bridge:");
        console.error("  Message:", err.message);
        console.error("=======================================\n");
    }
}

/**
 * Check Polygon chain for withdrawal events
 * Scans new blocks and processes WithdrawIntent events
 */
async function checkPolygonWithdrawals() {
    try {
        const currentBlock = await providerPolygon.getBlockNumber();
        
        // Initialize starting block on first run
        if (lastBlockPolygon === 0) {
            // If START_FROM_CURRENT is true, skip historical events
            if (START_FROM_CURRENT) {
                lastBlockPolygon = currentBlock;
                console.log("Connected to Polygon. Current block:", currentBlock);
                console.log("  START_FROM_CURRENT enabled - skipping historical events");
                console.log("Starting from block:", lastBlockPolygon);
            } else {
                lastBlockPolygon = currentBlock - 50;
                console.log("Connected to Polygon. Current block:", currentBlock);
                console.log("Starting from block:", lastBlockPolygon);
            }
            console.log("Listening for Polygon WithdrawIntent events...\n");
        }
        
        if (currentBlock > lastBlockPolygon) {
            const fromBlock = lastBlockPolygon + 1;
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
            
            const filter = bridgeMintBurn.filters.WithdrawIntent();
            const events = await bridgeMintBurn.queryFilter(filter, fromBlock, toBlock);
            
            if (events.length > 0) {
                console.log("\n[POLYGON] Found", events.length, "WithdrawIntent event(s)");
                
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

/**
 * Process Polygon -> Base withdrawal
 * 1. Submit data to Avail DA
 * 2. Release original tokens on Base
 */
async function handlePolygonToBase(event) {
    const { user, amount, withdrawNonce } = event.args;
    
    // Skip if already processed in memory
    const nonceStr = withdrawNonce.toString();
    if (processedWithdrawNonces.has(nonceStr)) {
        console.log(`  Skipping withdrawal nonce ${nonceStr} - already processed`);
        return;
    }
    
    // Check if already processed on blockchain
    try {
        const isProcessed = await tokenConsumer.processedNonces(withdrawNonce);
        if (isProcessed) {
            console.log(`  Skipping withdrawal nonce ${nonceStr} - already processed on Base blockchain`);
            processedWithdrawNonces.add(nonceStr); // Add to cache
            return;
        }
    } catch (err) {
        console.error(`  Could not check nonce ${nonceStr} status:`, err.message);
    }
    
    console.log("\n=======================================");
    console.log("POLYGON -> BASE WITHDRAWAL DETECTED");
    console.log("=======================================");
    console.log("User:", user);
    console.log("Amount:", ethers.formatEther(amount), "tokens");
    console.log("Withdraw Nonce:", withdrawNonce.toString());
    console.log("Block:", event.blockNumber);
    console.log("Transaction:", event.transactionHash);
    
    try {
        // Step 1: Submit to Avail DA for data availability proof
        console.log("\nStep 1: Publishing to Avail DA...");
        const availResult = await submitToAvail(
            user, 
            amount, 
            withdrawNonce, 
            "polygon_to_base"
        );
        console.log("Avail confirmation received");
        console.log("  Block:", availResult.blockNumber);
        console.log("  Data Hash:", availResult.dataHash);
        
        // Step 2: Release original tokens on Base
        console.log("\nStep 2: Releasing original tokens on Base...");
        const tx = await tokenConsumerWithSigner.release(user, amount, withdrawNonce);
        console.log("  Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("  Confirmed in block:", receipt.blockNumber);
        
        // Mark as processed
        processedWithdrawNonces.add(nonceStr);
        
        console.log("\nSUCCESS: Bridge completed");
        console.log("  Amount:", ethers.formatEther(amount), "TKN1");
        console.log("  Recipient:", user);
        console.log("  Avail Block:", availResult.blockNumber);
        console.log("=======================================\n");
        
    } catch (err) {
        console.error("\nERROR during Polygon->Base bridge:");
        console.error("  Message:", err.message);
        console.error("=======================================\n");
    }
}

// Start event listeners
console.log("Starting event listeners...\n");

// Poll both chains every 3 seconds
setInterval(async () => {
    await checkBaseDeposits();
    await checkPolygonWithdrawals();
}, 3000);

// Run initial checks immediately
checkBaseDeposits();
checkPolygonWithdrawals();

// Graceful shutdown handler
process.on('SIGINT', () => {
    console.log('\n\nRelayer shutting down...');
    process.exit(0);
});