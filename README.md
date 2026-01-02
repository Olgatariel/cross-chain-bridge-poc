# Base ↔ Polygon Bridge POC

A bidirectional token bridge between Base and Polygon networks using wrapped token architecture.

## Overview

This project implements a two-way bridge that allows users to transfer ERC-20 tokens between Base and Polygon chains. When tokens move from Base to Polygon, they are locked on Base and wrapped tokens are minted on Polygon. Users can bridge back anytime.

**Current Status:** Phase 1 Complete - Smart contracts and tests implemented  
**Next Phase:** Relayer implementation and Avail integration

## Why Wrapped Token Architecture?

We migrated from simple lock/unlock to wrapped tokens because:
- ✅ No need to pre-fund both chains
- ✅ 1:1 backing guarantee (locked tokens = minted tokens)
- ✅ Production-ready pattern (like WETH, USDC bridges)
- ✅ Better scalability

## Architecture

```
Base Chain (Source)              
Polygon Chain (Destination)
━━━━━━━━━━━━━━━━━━              ━━━━━━━━━━━━━━━━━━━━━━━━━

Token1.sol                       WrappedToken1.sol
  ↓ lock                           
  ↑ mint
TokenConsumer.sol  ←──relayer──→ BridgeMintBurn.sol
  ↑ unlock                         
  ↓ burn
```

### How It Works

**Base → Polygon (Deposit):**
1. User approves and deposits tokens on Base
2. Tokens are locked in TokenConsumer contract
3. Relayer detects event and mints wrapped tokens on Polygon
4. User receives wrapped tokens on Polygon

**Polygon → Base (Withdrawal):**
1. User requests withdrawal on Polygon
2. Wrapped tokens are burned immediately (prevents double-spend!)
3. Relayer detects event and releases tokens on Base
4. User receives original tokens on Base

## Smart Contracts

### Base Chain

**Token1.sol** - Original ERC-20 token
- Has faucet for testing (100 tokens every 24 hours)
- Owner can mint for special needs

**TokenConsumer.sol** - Lock/unlock bridge contract
- `deposit()` - Lock tokens when bridging to Polygon
- `release()` - Unlock tokens when bridging back from Polygon
- Separate nonce tracking prevents replay attacks

### Polygon Chain

**WrappedToken1.sol** - Wrapped ERC-20 token
- Minted when Base tokens are locked
- Only BRIDGE_ROLE can mint/burn
- No initial supply (created on demand)

**BridgeMintBurn.sol** - Bridge controller
- `mintWrapped()` - Mint wrapped tokens after Base deposit
- `requestWithdraw()` - Burn tokens and initiate withdrawal
- Atomic burn prevents double-spending

## Key Security Features

**Dual Nonce System** - Separate nonces for each direction prevent conflicts:
```
Base:    currentNonce (outgoing) + processedNonces (incoming)
Polygon: withdrawNonce (outgoing) + processedDeposits (incoming)
```

**Atomic Operations** - Tokens burned immediately on withdrawal request:
```solidity
// Burn happens BEFORE emitting event
wrappedToken.burn(msg.sender, amount);
emit WithdrawIntent(msg.sender, amount, nonce++);
```

**Role-Based Access** - Only authorized addresses can execute bridge operations

## Project Structure

```
contracts/
├── Token1.sol              # Base: Original token
├── TokenConsumer.sol       # Base: Lock/unlock
├── WrappedToken1.sol       # Polygon: Wrapped token
└── BridgeMintBurn.sol      # Polygon: Mint/burn controller

test/
├── Token1_tests            # Unit tests
├── TokenConsumer_tests     # Unit tests
├── WrappedToken1_tests     # Unit tests
├── BridgeMintBurn_tests    # Unit tests
└── Bridge_Integration_Tests # Full bridge flows
```

## Testing

We have comprehensive tests covering:
- ✅ All contract functions
- ✅ Access control
- ✅ Replay attack prevention
- ✅ Double-spending prevention
- ✅ Full bridge flows (Base → Polygon → Base)
- ✅ Multiple users simultaneously
- ✅ Edge cases and security

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
- Token1: ✅ 15 tests passing
- TokenConsumer: ✅ 18 tests passing
- WrappedToken1: ✅ 20 tests passing
- BridgeMintBurn: ✅ 22 tests passing
- Integration: ✅ 31 tests passing

## Getting Started

**Prerequisites:**
- Node.js >= 18.x
- npm or yarn

**Installation:**
```bash
# Clone repo
git clone <repository-url>
cd base-polygon-bridge

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test
```

**Configuration:**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
```

## Roadmap

### ✅ Phase 1: Smart Contracts (Complete)
- [x] Token1 with faucet
- [x] TokenConsumer lock/unlock
- [x] WrappedToken1 implementation
- [x] BridgeMintBurn controller
- [x] Dual nonce architecture
- [x] Comprehensive tests (106 tests total)
- [x] Gas optimization analysis

### 🔄 Phase 2: Off-chain Infrastructure (In Progress)
- [ ] **Relayer** - Automated event listening and transaction execution
- [ ] **Avail Helper** - Data availability layer integration
- [ ] Event monitoring system
- [ ] Error handling and retries

### 📝 Phase 3: Production Ready (Planned)
- [ ] Emergency pause mechanism
- [ ] Multi-signature for admin operations
- [ ] Rate limiting for large transfers
- [ ] Frontend interface
- [ ] Security audit
- [ ] Mainnet deployment

## Technical Details

**Token Flow Example:**
```
Initial:  Base: User 1000 TKN | Bridge 0 TKN
          Polygon: User 0 WTKN | Supply 0 WTKN

Deposit:  Base: User 500 TKN | Bridge 500 TKN (locked)
          Polygon: User 500 WTKN | Supply 500 WTKN (minted)

Withdraw: Base: User 800 TKN | Bridge 200 TKN (locked)
          Polygon: User 200 WTKN | Supply 200 WTKN (burned 300)

✅ Invariant: Locked tokens (200) = Wrapped supply (200)
```

**Nonce Example:**
```
1. deposit() on Base → DepositIntent(nonce=0)
2. mintWrapped() on Polygon → processedDeposits[0]=true
3. requestWithdraw() on Polygon → WithdrawIntent(nonce=0) ← Different nonce!
4. release() on Base → processedNonces[0]=true

No conflicts because each direction has separate nonce space.
```

## Known Limitations (POC Stage)

⚠️ This is a Proof of Concept. Known limitations:
- Centralized relayer (single point of failure)
- No emergency pause mechanism
- No rate limiting
- Owner can mint unlimited tokens (Token1)

These will be addressed in Phase 3 before production deployment.

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file

## Disclaimer

⚠️ **This is a Proof-of-Concept implementation. Do not use in production without proper security audit and testing.**

## Contact

For questions or issues, please open a GitHub issue.

---

**Built with:**
- Solidity 0.8.20
- OpenZeppelin Contracts
- Hardhat
- Ethers.js v6