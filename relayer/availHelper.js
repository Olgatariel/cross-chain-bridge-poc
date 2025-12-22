require("dotenv").config();
const { SDK, Account, Pallets } = require("avail-js-sdk");

/**
 * Avail DA Helper - Submits bridge transaction data to Avail Data Availability layer
 * Provides decentralized data availability proof for cross-chain bridge operations
 * Used by relayer to publish lock events from Base before crediting on Polygon
 */

let sdk = null;
let account = null;

async function initializeAvail() {
    if (sdk) return; 
    
    console.log("Initializing Avail connection...");
    
    
    sdk = await SDK.New(process.env.AVAIL_RPC || 'wss://turing-rpc.avail.so/ws');
    
    const seed = process.env.AVAIL_SEED;
    if (!seed) {
        throw new Error("AVAIL_SEED not set in .env");
    }
    
    account = Account.new(seed);
    console.log(" Avail initialized. Account:", account.address);
}

async function submitToAvail(user, amount, nonce) {
    await initializeAvail();
    
    const appId = parseInt(process.env.AVAIL_APP_ID || "509");
    
    const bridgeData = {
        user: user,
        amount: amount.toString(),
        nonce: nonce,
        timestamp: Date.now(),
        sourceChain: "Base Sepolia"
    };
    
    const dataString = JSON.stringify(bridgeData);
    
    console.log(` Submitting to Avail DA (AppID: ${appId})...`);
    console.log(`   Data:`, dataString);
    
    const tx = sdk.tx.dataAvailability.submitData(dataString);
    
    const res = await tx.executeWaitForInclusion(account, { app_id: appId });
    
    if (!res.isSuccessful()) {
        throw new Error("Avail transaction failed");
    }
    
    const event = res.events.findFirst(Pallets.DataAvailabilityEvents.DataSubmitted);
    if (!event) {
        throw new Error("DataSubmitted event not found");
    }
    
    console.log(` Data submitted to Avail!`);
    console.log(`   Block: ${res.blockNumber}`);
    console.log(`   Tx Hash: ${res.txHash}`);
    console.log(`   Data Hash: ${event.dataHash}`);
    
    return {
        blockNumber: res.blockNumber,
        blockHash: res.blockHash,
        txHash: res.txHash,
        dataHash: event.dataHash
    };
}

module.exports = { submitToAvail };