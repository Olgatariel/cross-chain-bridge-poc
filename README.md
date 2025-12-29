# PoC Bridge Project

This is my Proof-of-Concept (PoC) project for moving tokens between two blockchains.

## Goal

The project shows a simple "bridge" logic for tokens between two blockchains without any currency exchange and demonstrates how a relayer and Avail Data Availability can be used for cross-chain messaging.

## How it works

1. **Blockchain A (Base Sepolia)**

   - The user has some `Token1`.
   - The user locks some tokens in the `TokenConsumer` contract.
   - The contract emits an event with the deposit information.

2. **Bridge / message**

   - A relayer listens for deposit events on chain A.
   - After tokens are locked, the relayer takes the message data (user address and amount).
   - This data is submitted to Avail Data Availability to store it in a decentralized way.
   - After that, the relayer sends a transaction to blockchain B.
   - TokenConsumer (on chain A) and VirtualBalanceVault (on chain B) are the contracts involved in the bridge logic.

3. **Blockchain B (Polygon Amoy)**
   - The VirtualBalanceVault contract receives the message via the relayer.
   - The user gets the same amount of tokens on this chain (as a virtual balance).
   - From the user perspective, the balance on chain A goes down and the balance on chain B goes up.

## Contracts

- `Token1.sol` – a simple ERC-20 token.
- `TokenConsumer.sol` – contract on chain A to lock tokens and emit bridge events.
- `VirtualBalanceVault.sol` – contract on chain B to track and give tokens to users.

## Avail

The bridge needs verifiable proof that deposits occurred on the source chain. Without it, users must blindly trust the relayer. Avail provides:

1. **Proof of deposit**: Creates immutable record of each bridge transaction
2. **Independent verification**: Anyone can verify bridge operations without trusting the relayer
3. **Decentralized storage**: Data stored across validator network, not single server
4. **Audit trail**: Complete history of all bridge transactions for debugging and auditing

## Relayer

The relayer is an off-chain Node.js script that connects both blockchains. It continuously monitors Base Sepolia for deposit events, submits data to Avail DA, and credits virtual balances on Polygon Amoy.

### Why 24/7 Hosting?

The relayer must run continuously to:

- Listen for deposit events in real-time
- Process bridge transactions automatically
- Ensure users don't need to wait or run anything manually

Running locally would require keeping your computer on 24/7, so cloud hosting is essential for a production-ready bridge.

### Why Railway?

Railway was chosen for relayer deployment due to technical advantages for POC development:

**Key Technical Reasons:**

1. **Zero infrastructure configuration** - No VPC setup, load balancers, or networking required; automatic HTTPS and container orchestration
2. **Native Git integration** - Automatic deployment on `git push` without configuring CI/CD pipelines
3. **Built-in secrets management** - Encrypted environment variables with zero setup, automatically injected at runtime
4. **Real-time logging** - Live log streaming in dashboard without additional configuration
5. **Cost-effective for POC** - $5 free credit (25-30 days of operation) with predictable pricing
6. **Instant deployment cycle** - 10-minute setup vs 2+ hours for Google Cloud/AWS equivalent

**Trade-offs:**

Railway is optimized for POC/MVP deployment. For production-scale bridges with enterprise features (VPC peering, compliance certifications, multi-region deployments), cloud providers would be more appropriate despite higher complexity.

### Deployment Steps

1. **Sign up** at https://railway.app (use GitHub authentication)

2. **Create new project** → Deploy from GitHub repo

3. **Configure root directory:**

   - Settings → Set root directory to `relayer`
   - This ensures Railway only deploys the relayer folder, not the entire Hardhat project

4. **Set start command:**

   - Settings → Start Command: `node relayer.js`

5. **Add environment variables** (Settings → Variables):

```
   RPC_CHAIN_A=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
   RPC_CHAIN_B=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
   PRIVATE_KEY=your_relayer_wallet_private_key
   AVAIL_SEED=twelve word seed phrase here
   AVAIL_APP_ID=509
   AVAIL_RPC=wss://turing-rpc.avail.so/ws
```

All variables are encrypted by Railway and never exposed in logs.

6. **Deploy:**
   - Railway automatically builds and deploys on every `git push`
   - Monitor deployment in Railway dashboard → Deployments tab
   - View real-time logs in Logs tab

### Key Files

- `relayer/relayer.js` - Main event listener with polling logic
- `relayer/availHelper.js` - Avail DA submission utilities
- `relayer/package.json` - Dependencies (ethers v6, avail-js-sdk)

### How It Works

1. **Event polling:** Checks Base Sepolia every 3 seconds for new blocks
2. **Block scanning:** Scans 10 blocks at a time (Alchemy free tier limit)
3. **Event detection:** Filters for `DepositIntent` events from TokenConsumer
4. **Avail submission:** Publishes event data to Avail DA for decentralized storage
5. **Cross-chain credit:** Calls `credit()` on Polygon Amoy VirtualBalanceVault
6. **Logging:** Outputs transaction details with explorer links

### Monitoring

Railway dashboard provides:

- Service status (Online/Crashed)
- Real-time logs with event detection
- Deployment history
- Resource usage

Example log output:

```
🎧 Relayer Started!
✅ Connected to Base Sepolia. Current block: 35596382
📡 Listening for DepositIntent events...

🔔 ═══ DepositIntent detected! ═══
User: 0x9AB408...1d05
Amount: 5.0 tokens
📡 Publishing to Avail DA...
✅ Data submitted to Avail!
💰 Crediting virtual balance on Polygon Amoy...
✅ SUCCESS! 5.0 credited to 0x9AB408...1d05
```

### Common Issues & Solutions

**Event not detected:**

- Relayer scans from `currentBlock - 50` on startup
- Old transactions before relayer start are not processed
- Solution: Make a new bridge transaction after relayer is online

**Avail submission fails:**

- Check AVAIL_SEED is correct (12 words, space-separated)
- Ensure Avail wallet has testnet tokens
- Verify AVAIL_APP_ID matches your application

**Polygon credit fails:**

- Relayer wallet needs MATIC for gas on Polygon Amoy
- Get testnet MATIC from https://faucet.polygon.technology/

**ABI mismatch error:**

- Contract ABI in relayer must exactly match deployed contract
- Fixed by using full ABI format instead of minimal human-readable strings

## Frontend

**Live demo:** https://cross-chain-bridge-poc.vercel.app

A React-based UI that allows users to bridge tokens between Base Sepolia and Polygon Amoy with wallet connection via RainbowKit.

### Tech Stack

- React + Vite
- RainbowKit + wagmi v2 for wallet connection
- Tailwind CSS for styling
- Vercel for hosting

### Setup

1. **Install dependencies:**

```bash
cd frontend
npm install
```

2. **Key packages:**

   - `@rainbow-me/rainbowkit` - Pre-built wallet connection UI
   - `wagmi` - React hooks for Ethereum interactions
   - `viem` - Low-level Ethereum utilities
   - `@tanstack/react-query` - Async state management

3. **Configuration files:**

   - `wagmi.js` - Chain configuration (Base Sepolia, Polygon Amoy) and WalletConnect setup
   - `App.jsx` - Main bridge UI with balance display and transaction flow
   - Contract addresses and ABIs are embedded directly in code

4. **Run locally:**

```bash
npm run dev
# Opens on http://localhost:5173
```

5. **Deploy to Vercel:**
   - Connect GitHub repository to Vercel dashboard
   - Vercel auto-detects Vite configuration
   - Automatic deployment on every `git push` to main branch

### Features

- **Wallet Connection:** Supports MetaMask, WalletConnect, Coinbase Wallet, etc.
- **Dual Balance Display:**
  - Base Sepolia: Real ERC-20 token balance (reads from Token1 contract)
  - Polygon Amoy: Virtual balance (reads from VirtualBalanceVault contract)
- **Bridge Flow:**
  1. User enters amount
  2. Approve tokens (ERC-20 approval for TokenConsumer)
  3. Deposit to bridge (locks tokens, emits event)
  4. Relayer processes automatically
  5. Balances update (Base decreases, Polygon increases)
- **Network Handling:**
  - Automatically prompts network switch if user is on wrong chain
  - Bridge transactions only work on Base Sepolia (source chain)

### Implementation Notes

**Cross-chain balance reading:**

- Uses `createPublicClient` from viem to read Polygon balance independently
- This allows displaying Polygon balance even when MetaMask is connected to Base Sepolia
- Without this, wagmi hooks would only read from the currently connected network

**Transaction flow:**

```javascript
// Step 1: Approve
approve({
  address: TOKEN_ADDRESS,
  abi: TOKEN_ABI,
  functionName: "approve",
  args: [CONSUMER_ADDRESS, amount],
});

// Step 2: Deposit (after approve confirms)
deposit({
  address: CONSUMER_ADDRESS,
  abi: CONSUMER_ABI,
  functionName: "deposit",
  args: [amount, 80002n], // 80002 = Polygon Amoy chainId
});
```

**Balance refresh:**

- Base balance: `refetchBalance()` after successful deposit
- Polygon balance: Polls every 10 seconds + refetches after deposit
- Virtual balance updates after relayer processes the transaction (typically 30-60 seconds)

### Deployment

Vercel deployment is fully automated:

1. Push code to GitHub main branch
2. Vercel detects changes and triggers build
3. Runs `npm run build` (creates production bundle)
4. Deploys to https://cross-chain-bridge-poc.vercel.app
5. Previous deployment remains accessible until new one is ready (zero downtime)

Build time: ~2-3 minutes
Any build errors are shown in Vercel dashboard with detailed logs.

## Scripts

- `deployToken.js` – Deploys Token1 to Base Sepolia
- `deployConsumer.js` – Deploys TokenConsumer to Base Sepolia
- `deployVirtualBalanceVault.js` – Deploys VirtualBalanceVault to Polygon Amoy
- `interactPoC.js` – Example script for testing bridge flow manually

## Architecture

```
User (Frontend)
  |
  | 1. deposit(Token1)
  ▼
TokenConsumer
(Base Sepolia)
  |
  | 2. DepositIntent event
  ▼
Relayer (Railway)
  |
  | 3. submit data
  ▼
Avail DA Layer
(Turing Testnet)
  |
  | 4. data confirmation + hash
  ▼
Relayer (Railway)
  |
  | 5. execute credit()
  ▼
VirtualBalanceVault
(Polygon Amoy)
  |
  | 6. virtual balance updated
  ▼
User (Frontend)
```

## Project Structure

```
my-hardhat-ignition/
├── contracts/
│   └── PoC-Bridge/
│       ├── Token1.sol                      # ERC-20 token
│       ├── TokenConsumer.sol               # Base Sepolia - locks tokens
│       └── VirtualBalanceVault.sol         # Polygon Amoy - tracks balances
├── scripts/
│   ├── deployToken.js
│   ├── deployConsumer.js
│   ├── deployVirtualBalanceVault.js
│   └── interactPoC.js
├── relayer/
│   ├── relayer.js                          # Main event listener
│   ├── availHelper.js                      # Avail DA integration
│   ├── package.json                        # Dependencies (ethers, avail-js-sdk)
│   └── .env                                # Environment variables (not in repo)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                         # Bridge UI
│   │   ├── wagmi.js                        # Chain configuration
│   │   └── main.jsx                        # React entry point
│   ├── package.json
│   └── vite.config.js
└── hardhat.config.js                       # Hardhat configuration
```

## Technologies Used

- **Smart Contracts:** Solidity, Hardhat, OpenZeppelin
- **Blockchains:** Base Sepolia (testnet), Polygon Amoy (testnet)
- **Data Availability:** Avail Turing (testnet)
- **Relayer:** Node.js, ethers.js v6, avail-js-sdk
- **Frontend:** React, Vite, RainbowKit, wagmi, Tailwind CSS
- **Hosting:** Vercel (frontend), Railway (relayer)

## Running the Full Stack

1. **Deploy contracts** (if not already deployed)
2. **Start relayer locally** for testing: `node relayer/relayer.js`
3. **Start frontend locally**: `cd frontend && npm run dev`
4. **Test bridge**: Connect wallet, enter amount, bridge tokens
5. **Monitor relayer logs** to see event processing
6. **Deploy relayer to Railway** for production use
7. **Deploy frontend to Vercel** for public access

## Future Improvements

1. **Real token minting** - Replace virtual balance with wrapped tokens (wTKN1) that can be transferred between users

2. **Bidirectional bridge** - Add reverse bridge (Polygon → Base) with withdraw functionality

3. **Multi-token support** - Extend to support multiple ERC-20 tokens (USDC, DAI, WETH)

4. **Security features** - Add rate limiting, maximum bridge amounts, pause mechanism, and multi-sig requirements

5. **Signature verification** - Implement cryptographic proof verification in contracts instead of trusting relayer

6. **Price oracle integration** - Add Chainlink oracles for real-time token price feeds

7. **DEX functionality** - Enable currency exchange during bridge (e.g., bridge TKN1 → receive USDC on destination chain at current market rate with slippage protection)