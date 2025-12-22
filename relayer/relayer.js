require("dotenv").config();
const { ethers } = require("ethers");
const { submitToAvail } = require("./availHelper");

/**
 * Bridge Relayer - Automated cross-chain transaction processor
 * Listens for deposit events on Base Sepolia, submits data to Avail DA for verification,
 * then automatically credits virtual balances on Polygon Amoy
 * Acts as the bridge between chains since smart contracts cannot communicate directly
 */

const providerA = new ethers.JsonRpcProvider(process.env.RPC_CHAIN_A);
const providerB = new ethers.JsonRpcProvider(process.env.RPC_CHAIN_B);

const walletB = new ethers.Wallet(process.env.PRIVATE_KEY, providerB);

const TokenConsumerABI = require("../artifacts/contracts/PoC-Bridge/TokenConsumer.sol/TokenConsumer.json").abi;
const VaultABI = require("../artifacts/contracts/PoC-Bridge/VirtualBalanceVault.sol/VirtualBalanceVault.json").abi;

const tokenConsumerAddress = "0x787f3F838a126491F651207Bb575E07D9a95Da5b";
const vaultAddress = "0x46BFEbbb31042ee6b0315612830Bb056Eb2443Af";

const tokenConsumer = new ethers.Contract(tokenConsumerAddress, TokenConsumerABI, providerA);
const vault = new ethers.Contract(vaultAddress, VaultABI, walletB);

console.log(" Relayer Started!");
console.log("═══════════════════════════════════");
console.log("Chain A (Base Sepolia):", tokenConsumerAddress);
console.log("Chain B (Polygon Amoy):", vaultAddress);
console.log("Relayer wallet:", walletB.address);
console.log("Avail AppID:", process.env.AVAIL_APP_ID);
console.log("═══════════════════════════════════");

console.log("\n Starting event listener...");

providerA.pollingInterval = 3000;

let lastBlock = 0;
const MAX_BLOCK_RANGE = 10; 

async function checkForEvents() {
    try {
        const currentBlock = await providerA.getBlockNumber();
        
        if (lastBlock === 0) {
            lastBlock = currentBlock - 1;
            console.log(`✅ Connected to Base Sepolia. Current block: ${currentBlock}`);
            console.log("📡 Listening for DepositIntent events...\n");
        }
        
        if (currentBlock > lastBlock) {
            const fromBlock = lastBlock + 1;
            const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
            
            const filter = tokenConsumer.filters.DepositIntent();
            const events = await tokenConsumer.queryFilter(filter, fromBlock, toBlock);
            
            if (events.length > 0) {
                for (const event of events) {
                    console.log("\n🔔 ═══ DepositIntent detected! ═══");
                    console.log("User:", event.args.user);
                    console.log("Amount:", ethers.formatEther(event.args.amount), "tokens");
                    console.log("Destination chain:", event.args.destinationChainId.toString());
                    console.log("Block:", event.blockNumber);
                    console.log("Transaction:", event.transactionHash);
                    
                    await handleIntent(event.args.user, event.args.amount, event.blockNumber);
                }
            }
            
            lastBlock = toBlock;
        }
    } catch (error) {
        
        if (!error.message.includes("10 block range")) {
            console.error("Error checking events:", error.message);
        }
    }
}

setInterval(checkForEvents, 3000);

async function handleIntent(user, amount, nonce) {
    try {
        console.log(`\n Publishing to Avail DA...`);
        const availResult = await submitToAvail(user, amount, nonce);
        console.log(` Avail confirmation received!`);
        
        console.log(`\n Crediting virtual balance on Polygon Amoy...`);
        
        const tx = await vault.credit(user, amount);
        console.log("   → Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("   → Confirmed in block:", receipt.blockNumber);
        console.log(`   → View: https://www.oklink.com/amoy/tx/${receipt.hash}`);
        
        console.log(`\n SUCCESS! ${ethers.formatEther(amount)} credited to ${user}`);
        console.log(`   Avail Block: ${availResult.blockNumber}`);
        console.log(`   Avail Data Hash: ${availResult.dataHash}`);
        
    } catch (err) {
        console.error("\n ERROR:");
        console.error("   →", err.message);
    }
}

process.on('SIGINT', () => {
    console.log('\n\n Relayer shutting down...');
    process.exit(0);
});

checkForEvents();