# Base ↔ Polygon Bridge POC

A bidirectional token bridge between Base and Polygon networks using wrapped token architecture with Avail Data Availability integration.

## Overview

This project implements a production-ready two-way bridge that allows users to transfer ERC-20 tokens between Base and Polygon chains. When tokens move from Base to Polygon, they are locked on Base and wrapped tokens are minted on Polygon. Users can bridge back anytime with full data availability guarantees.

**Current Status:** Phase 2 Complete - Full bridge operational on testnet  
**Testnet Deployment:** Base Sepolia ↔ Polygon Amoy  
**Next Phase:** Frontend development

## Live Demo

**Testnet Contracts:**

- **Base Sepolia:**

  - Token1: `0x6e7406e945B6a41b0B9e15F5F139a521d4bbae41`
  - TokenConsumer: `0x66A58371c29DcDca9991C2f27df6aAeF4EbAe0F0`

- **Polygon Amoy:**
  - WrappedToken1: `0x9a801c2fF18234ce990c98d253Ebe6c49EB8eBEa`
  - BridgeMintBurn: `0xFc454442344EcF8502ddC7Fb8Ea90eb1D3178e1C`

**Relayer:** Running 24/7 on Railway  
**Data Availability:** Avail Turing Testnet (AppID: 509)

## Why Wrapped Token Architecture?

I moved from a simple lock/unlock model to wrapped tokens because it was genuinely interesting for me to build this kind of product and understand how real cross-chain bridges work in practice.

- No need to pre-fund both chains
- 1:1 backing guarantee (locked tokens = minted tokens)
- Production-ready pattern (like WETH, USDC bridges)
- Better scalability
- Atomic operations prevent double-spending

## Architecture

```
Base Chain (Source)              Avail DA              Polygon Chain (Destination)
━━━━━━━━━━━━━━━━━━              ━━━━━━━━━━            ━━━━━━━━━━━━━━━━━━━━━━━━━

Token1.sol                         │                   WrappedToken1.sol
  ↓ lock                           │                     ↑ mint
TokenConsumer.sol  ──relayer──→ Submit ──relayer──→ BridgeMintBurn.sol
  ↑ unlock          ←─relayer──← Verify ←─relayer───   ↓ burn
```

### How It Works

**Base → Polygon (Deposit):**

1. User approves and deposits tokens on Base
2. Tokens are locked in TokenConsumer contract
3. Relayer detects `DepositIntent` event
4. Relayer submits transaction data to Avail DA
5. Relayer mints wrapped tokens on Polygon
6. User receives wrapped tokens on Polygon

**Polygon → Base (Withdrawal):**

1. User requests withdrawal on Polygon
2. Wrapped tokens are burned **immediately** (atomic - prevents double-spend!)
3. Relayer detects `WithdrawIntent` event
4. Relayer submits transaction data to Avail DA
5. Relayer releases original tokens on Base
6. User receives original tokens back on Base

**Data Availability:** All bridge transactions are published to Avail DA before execution, ensuring decentralized verification and fraud proofs.

## Smart Contracts

### Base Chain

**Token1.sol** - Original ERC-20 token

- Has faucet for testing (100 tokens every 24 hours)
- Owner can mint for special needs
- Standard ERC-20 functionality

**TokenConsumer.sol** - Lock/unlock bridge contract

- `deposit(amount)` - Lock tokens when bridging to Polygon
- `release(to, amount, nonce)` - Unlock tokens when bridging back (relayer only)
- Separate nonce tracking prevents replay attacks
- Access control: only relayer can call `release()`

### Polygon Chain

**WrappedToken1.sol** - Wrapped ERC-20 token

- Minted when Base tokens are locked
- Only BRIDGE_ROLE can mint/burn
- No initial supply (created on demand)
- Standard ERC-20 with role-based access control

**BridgeMintBurn.sol** - Bridge controller

- `mintWrapped(to, amount, depositNonce)` - Mint wrapped tokens after Base deposit (relayer only)
- `withdraw(amount)` - User initiates withdrawal, tokens burned immediately
- Atomic burn prevents double-spending
- Dual nonce system prevents replay attacks

## Off-Chain Infrastructure

### Relayer (relayer.js)

**Status:** Running on Railway (24/7 uptime)

**Capabilities:**

- Monitors both Base and Polygon chains simultaneously
- Detects events in real-time (3-second polling)
- Processes transactions bidirectionally
- Automatic retry on failures
- Comprehensive error handling

**Architecture:**

```javascript
// Bidirectional event monitoring
checkBaseDeposits()    → DepositIntent   → handleBaseToPolygon()
checkPolygonWithdrawals() → WithdrawIntent → handlePolygonToBase()
```

### Avail Helper (availHelper.js)

**Status:** Integrated with Avail Turing Testnet

**Features:**

- Submits all bridge transactions to Avail DA
- Provides data availability proofs
- Enables fraud proofs and verification
- AppID: 509 (dedicated bridge application)

**Data Structure:**

```json
{
  "user": "0x...",
  "amount": "1000000000000000000",
  "nonce": "1",
  "direction": "base_to_polygon",
  "timestamp": 1234567890,
  "sourceChain": "Base",
  "destinationChain": "Polygon"
}
```

## Key Security Features

**Dual Nonce System** - Separate nonces for each direction prevent conflicts:

```
Base:    currentNonce (outgoing) + processedNonces (incoming)
Polygon: withdrawNonce (outgoing) + processedDeposits (incoming)
```

**Atomic Operations** - Tokens burned immediately on withdrawal request:

```solidity
// Burn happens BEFORE emitting event - prevents double-spending!
wrappedToken.burn(msg.sender, amount);
emit WithdrawIntent(msg.sender, amount, nonce++);
```

**Role-Based Access Control:**

- Only relayer can execute `release()` on Base
- Only BRIDGE_ROLE can execute `mintWrapped()` on Polygon
- Only BRIDGE_ROLE can burn tokens from user addresses

**Replay Attack Prevention:**

- Each deposit nonce can only be processed once
- Each withdrawal nonce can only be processed once
- Nonces tracked separately per direction

**Data Availability:**

- All transactions published to Avail DA
- Enables fraud proofs and verification
- Decentralized data storage

## Project Structure

```
contracts/
├── Token1.sol              # Base: Original token
├── TokenConsumer.sol       # Base: Lock/unlock
├── WrappedToken1.sol       # Polygon: Wrapped token
└── BridgeMintBurn.sol      # Polygon: Mint/burn controller

test/
├── Token1.test.js               # Unit tests (15 tests)
├── TokenConsumer.test.js        # Unit tests (18 tests)
├── WrappedToken1.test.js        # Unit tests (20 tests)
├── BridgeMintBurn.test.js       # Unit tests (22 tests)
└── Bridge.integration.test.js   # Full flows (31 tests)

scripts/
├── deploy-base.js          # Base chain deployment
├── deploy-polygon.js       # Polygon chain deployment
└── setup-bridge.js         # Configure relayer permissions

relayer.js                  # Bidirectional event processor
availHelper.js             # Avail DA integration

deployments/
├── base.json              # Base contract addresses
├── polygon.json           # Polygon contract addresses
└── bridge-config.json     # Complete bridge configuration
```

## Testing

The comprehensive tests covering all aspects:

**Unit Tests:**

- All contract functions
- Access control mechanisms
- Edge cases and error conditions
- Gas optimization verification

**Integration Tests:**

- Full bridge flows (Base → Polygon → Base)
- Multiple users simultaneously
- Partial withdrawals
- User interactions on Polygon
- Replay attack prevention
- Double-spending prevention
- Atomic burn operations
- Supply invariant verification

**Run tests:**

```bash
# All tests
npx hardhat test

# With gas report
REPORT_GAS=true npx hardhat test

# Coverage
npx hardhat coverage
```

**Test Results:**

- Token1: 15/15 tests passing
- TokenConsumer: 18/18 tests passing
- WrappedToken1: 20/20 tests passing
- BridgeMintBurn: 22/22 tests passing
- Integration: 31/31 tests passing
- **Total: 106/106 tests passing**

**Coverage:** >95% line coverage across all contracts

## Deployment

### Prerequisites

- Node.js >= 18.x
- Testnet ETH on Base Sepolia
- Testnet MATIC on Polygon Amoy
- AVL tokens on Avail Turing

### Installation

```bash
# Clone repository
git clone <repository-url>
cd base-polygon-bridge

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys
```

### Deploy to Testnets

```bash
# 1. Deploy Base contracts
npx hardhat run scripts/deploy-base.js --network baseSepolia

# 2. Deploy Polygon contracts
npx hardhat run scripts/deploy-polygon.js --network polygonAmoy

# 3. Configure bridge (set relayer permissions)
npx hardhat run scripts/setup-bridge.js --network baseSepolia
```

### Start Relayer

**Local:**

```bash
node relayer.js
```

**Production (Railway):**

1. Connect GitHub repository to Railway
2. Add environment variables in Railway dashboard
3. Deploy automatically on push

Required environment variables:

```bash
RELAYER_PRIVATE_KEY=...
RPC_BASE=https://base-sepolia.g.alchemy.com/v2/...
RPC_POLYGON=https://polygon-amoy.infura.io/v3/...
TOKEN_CONSUMER_ADDRESS=...
BRIDGE_MINT_BURN_ADDRESS=...
AVAIL_RPC=wss://turing-rpc.avail.so/ws
AVAIL_SEED=...
AVAIL_APP_ID=509
```

## Roadmap

### Phase 1: Smart Contracts (Complete)

- Token1 with faucet
- TokenConsumer lock/unlock
- WrappedToken1 implementation
- BridgeMintBurn controller
- Dual nonce architecture
- Comprehensive tests (106 tests total)
- Gas optimization analysis
- Security features (replay protection, atomic burns)

### Phase 2: Off-chain Infrastructure (Complete)

- **Relayer** - Automated bidirectional event processing
- **Avail Helper** - Data availability layer integration
- Event monitoring system (both chains)
- Error handling and retries
- Testnet deployment (Base Sepolia + Polygon Amoy)
- 24/7 relayer on Railway
- End-to-end testing on testnet

### Phase 3: Production Ready (Next)

- **Frontend interface** - User-friendly bridge UI
- Multi-signature for admin operations
- Monitoring dashboard
- Security audit

## Technical Details

**Token Flow Example:**

```
Initial:  Base: User 1000 TKN | Bridge 0 TKN
          Polygon: User 0 WTKN | Supply 0 WTKN

Deposit:  Base: User 500 TKN | Bridge 500 TKN (locked)
          Polygon: User 500 WTKN | Supply 500 WTKN (minted)

Withdraw: Base: User 800 TKN | Bridge 200 TKN (locked)
          Polygon: User 200 WTKN | Supply 200 WTKN (burned 300)

 Invariant: Locked tokens (200) = Wrapped supply (200)
```

**Nonce Architecture:**

```
Base → Polygon:
1. deposit() on Base → DepositIntent(nonce=1)
2. mintWrapped() on Polygon → processedDeposits[1]=true

Polygon → Base:
1. withdraw() on Polygon → WithdrawIntent(nonce=0)  ← Different nonce space!
2. release() on Base → processedNonces[0]=true

No conflicts: Each direction has separate nonce tracking
```

**Performance:**

- Bridge transaction time: ~10-30 seconds
- Gas cost (Base deposit): ~65,000 gas
- Gas cost (Polygon withdraw): ~85,000 gas
- Relayer processing: ~3 second polling interval

## Live Testnet Usage

**Get Test Tokens:**

- Claim Token1 from faucet: Call `claimFaucet()` on Token1 contract

**Bridge Tokens:**

1. Approve TokenConsumer on Base
2. Call `deposit(amount)` on TokenConsumer
3. Wait ~20 seconds
4. Check WrappedToken1 balance on Polygon
5. Call `withdraw(amount)` on BridgeMintBurn to bridge back

**Verify on Explorers:**

- Base: https://sepolia.basescan.org/
- Polygon: https://amoy.polygonscan.com/
- Avail: https://explorer.avail.so/ (AppID: 509)

## Known Limitations (POC Stage)

This is a Proof of Concept deployed on testnets:

- Centralized relayer (single point of failure)
- No emergency pause mechanism
- No rate limiting
- Owner can mint unlimited tokens (Token1)

It has NOT undergone:

- Professional security audit
- Additional safety mechanisms
- Comprehensive monitoring
- Multi-signature governance
- Emergency response procedures

## Security

**Audit Status:** Not audited (POC stage)

**Security Features:**

- Replay attack prevention (dual nonce system)
- Double-spending prevention (atomic burns)
- Role-based access control
- Data availability proofs (Avail DA)
- Comprehensive test coverage

## License

MIT License - see [LICENSE](LICENSE) file

## Contact

For questions or issues, please open a GitHub issue.

---

**Built with:**

- Solidity 0.8.20
- OpenZeppelin Contracts v5.0
- Hardhat v2.28
- Ethers.js v6.16
- Avail JS SDK v0.4.2
- Deployed on Railway

**Networks:**

- Base Sepolia (Testnet)
- Polygon Amoy (Testnet)
- Avail Turing (Testnet)
