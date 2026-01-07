# Base ↔ Polygon Bridge POC

A two-way token bridge between Base and Polygon networks using wrapped token architecture with Avail Data Availability integration.

## What is this project?

This is a fully functional bridge that allowes transfer ERC-20 tokens between Base and Polygon networks. When tokens go from Base to Polygon - they get locked on Base and wrapped tokens are minted on Polygon. We can bridge them back anytime.

**Current Status:** Fully operational and deployed on testnet  
**Live Demo:** https://cross-chain-bridge-poc-git-d4877e-olga-tariielashvilis-projects.vercel.app/

## Live Deployment

**Contracts on Base Sepolia:**

- Token1: `0x6e7406e945B6a41b0B9e15F5F139a521d4bbae41`
- TokenConsumer: `0x66A58371c29DcDca9991C2f27df6aAeF4EbAe0F0`

**Contracts on Polygon Amoy:**

- WrappedToken1: `0x9a801c2fF18234ce990c98d253Ebe6c49EB8eBEa`
- BridgeMintBurn: `0xFc454442344EcF8502ddC7Fb8Ea90eb1D3178e1C`

**Infrastructure:**

- Relayer: Railway (24/7)
- Frontend: Vercel
- Data Availability: Avail Turing (AppID: 509)

## Why wrapped tokens?

I started with a simple one-way bridge, but then decided to rebuild it with wrapped token architecture. The main goal was to build a complete, functional bridge that works in both directions.

## How it works

### Architecture

```
Base Chain                    Avail DA              Polygon Chain
━━━━━━━━━━━━                 ━━━━━━━━━━            ━━━━━━━━━━━━━

Token1.sol                      │                  WrappedToken1.sol
  ↓ lock                        │                    ↑ mint
TokenConsumer.sol ──relayer──→ Submit ──relayer──→ BridgeMintBurn.sol
  ↑ unlock         ←─relayer──← Verify ←─relayer──   ↓ burn
```

### Base → Polygon (Deposit)

1. User approves and deposits tokens on Base
2. Tokens get locked in TokenConsumer contract
3. Relayer sees the `DepositIntent` event
4. Relayer publishes data to Avail DA
5. Relayer mints wrapped tokens on Polygon
6. User receives wTKN1 on Polygon

### Polygon → Base (Withdrawal)

1. User requests withdrawal on Polygon
2. Wrapped tokens are **burned immediately** (atomic operation - prevents double-spending!)
3. Relayer sees the `WithdrawIntent` event
4. Relayer publishes data to Avail DA
5. Relayer releases original tokens on Base
6. User receives their TKN1 back on Base

**Important detail:** All bridge transactions are published to Avail DA before execution. This provides decentralized verification and proof capabilities.

## What I built

### Smart Contracts

**On Base:**

- **Token1.sol** - original ERC-20 token with claim function (100 tokens every 24 hours - added for POC convenience)
- **TokenConsumer.sol** - bridge contract for locking/unlocking tokens

**On Polygon:**

- **WrappedToken1.sol** - wrapped ERC-20 token (minted on-demand)
- **BridgeMintBurn.sol** - bridge controller for minting/burning

### Off-Chain Infrastructure

**Relayer (relayer.js)**

- Monitors both networks simultaneously
- Processes events in real-time (3-second polling)
- Works bidirectionally (both directions)
- Automatic retry on failures
- Running 24/7 on Railway

**Avail Helper (availHelper.js)**

- Integration with Avail Turing testnet
- Publishes all bridge transactions
- Provides data availability proofs

### Frontend

**Tech Stack:**

- React + Vite
- Tailwind CSS
- ethers.js v6.16
- Deployed on Vercel

**Features:**

- MetaMask wallet connection
- Manual network selection (user chooses which direction to bridge)
- Balance display
- Token claim function (my own token, once per 24 hours - for POC convenience)
- Transaction history tracking
- Live bridge operation status

## Security Features (implemented)

✅ **Dual Nonce System** - separate nonces for each direction  
✅ **Atomic Burns** - tokens burned immediately on withdrawal  
✅ **Role-Based Access Control** - only relayer can call critical functions  
✅ **Replay Attack Prevention** - each nonce processed only once  
✅ **Data Availability** - all transactions in Avail DA  
✅ **Comprehensive Tests** - 106 tests, >95% code coverage

## Project Structure

```
contracts/
├── Token1.sol              # Base: Original token
├── TokenConsumer.sol       # Base: Lock/unlock
├── WrappedToken1.sol       # Polygon: Wrapped token
└── BridgeMintBurn.sol      # Polygon: Mint/burn controller

test/
├── Token1.test.js               # 15 unit tests
├── TokenConsumer.test.js        # 18 unit tests
├── WrappedToken1.test.js        # 20 unit tests
├── BridgeMintBurn.test.js       # 22 unit tests
└── Bridge.integration.test.js   # 31 integration tests

scripts/
├── deploy-base.js          # Deploy to Base
├── deploy-polygon.js       # Deploy to Polygon
└── setup-bridge.js         # Setup permissions

relayer.js                  # Bidirectional relayer
availHelper.js             # Avail DA integration

frontend/
├── src/
│   ├── components/         # React components
│   │   ├── BridgeForm.jsx
│   │   ├── WalletConnect.jsx
│   │   ├── NetworkSelector.jsx
│   │   ├── TransactionStatus.jsx
│   │   ├── RecentTransfers.jsx
│   │   └── FaucetButton.jsx
│   └── config/
│       ├── chains.js       # Base/Polygon configs
│       └── contracts.js    # Contract addresses & ABIs
├── package.json
└── vite.config.js
```

## How to run locally

### Prerequisites

```bash
# Node.js 18+
node --version

# Testnet tokens
# Base Sepolia ETH: https://faucet.quicknode.com/base/sepolia
# Polygon MATIC: https://faucet.polygon.technology/
# Avail AVL: https://faucet.avail.tools/
```

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/base-polygon-bridge.git
cd base-polygon-bridge

# Install dependencies
npm install

# Setup .env
cp .env.example .env
# Add your private keys
```

### Deploy Contracts

```bash
# 1. Deploy to Base Sepolia
npx hardhat run scripts/deploy-base.js --network baseSepolia

# 2. Deploy to Polygon Amoy
npx hardhat run scripts/deploy-polygon.js --network polygonAmoy

# 3. Setup permissions
npx hardhat run scripts/setup-bridge.js --network baseSepolia
```

### Start Relayer

```bash
# Locally
node relayer.js

# Or on Railway (recommended)
# 1. Push code to GitHub
# 2. Connect repository in Railway
# 3. Add environment variables
# 4. Deploy
```

### Start Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

## Testing

```bash
# Run all tests
npx hardhat test

# With gas report
REPORT_GAS=true npx hardhat test

# Coverage
npx hardhat coverage
```

**Test Results:**

- Token1: 15/15
- TokenConsumer: 18/18
- WrappedToken1: 20/20
- BridgeMintBurn: 22/22
- Integration: 31/31
- **Total: 106/106 passing**

## How to use (Live Testnet)

### 1. Connect wallet

Open https://cross-chain-bridge-poc-git-d4877e-olga-tariielashvilis-projects.vercel.app/

Connect MetaMask to Base Sepolia or Polygon Amoy.

### 2. Get test tokens

On Base Sepolia you can claim 100 TKN1 once every 24 hours (button in UI). This is my own token claim function added for POC convenience.

### 3. Bridge Base → Polygon

1. Select Base Sepolia direction
2. Enter amount (for example 50)
3. Click "Approve Tokens"
4. Click "Bridge to Polygon"
5. Wait ~10-30 seconds
6. Switch to Polygon Amoy in your wallet
7. Check wTKN1 balance

### 4. Bridge Polygon → Base

1. Select Polygon Amoy direction
2. Enter amount
3. Click "Bridge to Base"
4. Wait ~10-30 seconds
5. Switch to Base Sepolia in your wallet
6. Check TKN1 balance

## Performance

- **Bridge time:** ~10-30 seconds
- **Gas (Base deposit):** ~65,000 gas
- **Gas (Polygon withdraw):** ~85,000 gas
- **Relayer polling:** every 3 seconds

## Tech Stack

**Smart Contracts:**

- Solidity 0.8.20
- OpenZeppelin Contracts v5.0
- Hardhat v2.28

**Frontend:**

- React 18
- Vite
- Tailwind CSS
- ethers.js v6.16

**Infrastructure:**

- Relayer: Node.js on Railway
- Frontend: Vercel
- Data Availability: Avail JS SDK v0.4.2

**Networks:**

- Base Sepolia (testnet)
- Polygon Amoy (testnet)
- Avail Turing (testnet)

## Resources

**Explorers:**

- Base Sepolia: https://sepolia.basescan.org/
- Polygon Amoy: https://amoy.polygonscan.com/
- Avail: https://explorer.avail.so/

**Faucets:**

- Base Sepolia: https://faucet.quicknode.com/base/sepolia
- Polygon Amoy: https://faucet.polygon.technology/
- Avail: https://faucet.avail.tools/

**Documentation:**

- Base: https://docs.base.org/
- Polygon: https://wiki.polygon.technology/
- Avail: https://docs.availproject.org/

## License

MIT License
