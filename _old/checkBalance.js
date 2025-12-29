import { ethers } from "ethers";

// --- Налаштування ---
const RPC_URL = "https://polygon-amoy.g.alchemy.com/v2/hpUBCdd0ms8bWDsPRD6WS";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const vaultAddress = "0x46BFEbbb31042ee6b0315612830Bb056Eb2443Af";
const userAddress = "0x9AB408371F230089612bC523A54EdadDb6aA1d05";

// --- ABI мінімальний, тільки для getBalance ---
const ABI = [
  "function getBalance(address user) view returns (uint256)"
];

// --- Підключаємо контракт ---
const vault = new ethers.Contract(vaultAddress, ABI, provider);

async function main() {
  const balance = await vault.getBalance(userAddress);
  
  // Якщо токен має 18 десяткових
  const formattedBalance = ethers.formatUnits(balance, 18);

  console.log(`Virtual balance on Polygon for ${userAddress}: ${formattedBalance}`);
}

main().catch(console.error);