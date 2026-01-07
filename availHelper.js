require("dotenv").config();
const { SDK, Account, Pallets } = require("avail-js-sdk");

/**
 * Avail DA Helper - Submits bridge transaction data to Avail Data Availability layer
 * Provides decentralized data availability proof for bidirectional cross-chain bridge
 * Supports both Base→Polygon and Polygon→Base transfers
 */

let sdk = null;
let account = null;

async function initializeAvail() {
    if (sdk) return; 
    
    console.log("🔌 Initializing Avail connection...");
    
    sdk = await SDK.New(process.env.AVAIL_RPC || 'wss://turing-rpc.avail.so/ws');
    
    const seed = process.env.AVAIL_SEED;
    if (!seed) {
        throw new Error("AVAIL_SEED not set in .env");
    }
    
    account = Account.new(seed);
    console.log(" Avail initialized. Account:", account.address);
}

/**
 * Submit bridge data to Avail DA
 * @param {string} user - User address
 * @param {BigInt} amount - Token amount
 * @param {number} nonce - Transaction nonce
 * @param {string} direction - "base_to_polygon" or "polygon_to_base"
 */
async function submitToAvail(user, amount, nonce, direction) {
    await initializeAvail();
    
    const appId = parseInt(process.env.AVAIL_APP_ID || "509");
    
    const bridgeData = {
        user: user,
        amount: amount.toString(),
        nonce: nonce.toString(),
        direction: direction,
        timestamp: Date.now(),
        sourceChain: direction === "base_to_polygon" ? "Base" : "Polygon",
        destinationChain: direction === "base_to_polygon" ? "Polygon" : "Base"
    };
    
    const dataString = JSON.stringify(bridgeData);
    
    console.log(` Submitting to Avail DA (AppID: ${appId})...`);
    console.log(`   Direction: ${direction}`);
    console.log(`   Data:`, dataString);
    
    try {
        const tx = sdk.tx.dataAvailability.submitData(dataString);
        
        // Додаємо опції для кращого nonce management та priority
        const options = {
            app_id: appId,
            nonce: -1 // Auto-manage nonce
        };
        
        const res = await tx.executeWaitForInclusion(account, options);
        
        if (!res.isSuccessful()) {
            throw new Error("Avail transaction failed");
        }
        
        const event = res.events.findFirst(Pallets.DataAvailabilityEvents.DataSubmitted);
        if (!event) {
            throw new Error("DataSubmitted event not found");
        }
        
        console.log(" Data submitted to Avail!");
        console.log(`   Block: ${res.blockNumber}`);
        console.log(`   Tx Hash: ${res.txHash}`);
        console.log(`   Data Hash: ${event.dataHash}`);
        
        return {
            blockNumber: res.blockNumber,
            blockHash: res.blockHash,
            txHash: res.txHash,
            dataHash: event.dataHash
        };
    } catch (error) {
        console.error(" Avail submission error:", error.message);
        
        // Якщо помилка nonce - чекаємо і пробуємо ще раз
        if (error.message.includes("Priority is too low") || error.message.includes("nonce")) {
            console.log(" Waiting 5s and retrying...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Retry once
            const tx = sdk.tx.dataAvailability.submitData(dataString);
            const res = await tx.executeWaitForInclusion(account, { app_id: appId, nonce: -1 });
            
            if (res.isSuccessful()) {
                const event = res.events.findFirst(Pallets.DataAvailabilityEvents.DataSubmitted);
                console.log(" Retry successful!");
                return {
                    blockNumber: res.blockNumber,
                    blockHash: res.blockHash,
                    txHash: res.txHash,
                    dataHash: event.dataHash
                };
            }
        }
        
        throw error;
    }

}

module.exports = { submitToAvail };