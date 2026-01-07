# Bidirectional Bridge POC — Lessons Learned

This document summarizes common challenges and lessons learned while building a bidirectional bridge between blockchain networks such as Base Sepolia and Polygon Amoy.

---

## 1. Network and RPC

### API limits and endpoints
- Free API slots on providers like Alchemy or Infura can be limited.
- Public RPC endpoints can work for testing, but private or dedicated endpoints are recommended for production to ensure reliability.

### Test token availability
- Getting test tokens (ETH, MATIC, or other testnet tokens) can be difficult, as faucets may fail or provide very small amounts.
- Gas-intensive transactions require planning to avoid running out of test tokens.

### Gas costs
- Gas fees on some testnets (e.g., Polygon Amoy) can be higher than expected.
- Always estimate gas usage in advance and plan token allocation accordingly.

---

## 2. Relayer Considerations

### Relayer wallet balance
- A bridge relayer requires sufficient native tokens to pay for gas on all supported networks.
- Transactions may appear stuck if the relayer runs out of funds.
- Recommendation: continuously monitor relayer balances and consider automatic gas top-ups.

### Atomic operations
- Operations such as burning wrapped tokens and emitting events must be atomic.
- Always burn tokens first, then emit events or notifications.

### Nonce management
- Using the same nonce for both directions of a bidirectional bridge can lead to conflicts.
- Best practice: maintain separate nonce counters for outgoing and incoming transactions on each network.

---

## 3. Recommended Improvements and Best Practices

### Relayer security and reliability
- Use multi-signature wallets instead of a single relayer wallet.
- Implement automatic gas refill mechanisms.
- Add real-time monitoring dashboards.

### Smart contract design
- Implement automatic refunds if relayer execution fails.
- Add emergency pause mechanisms.
- Apply rate limiting to prevent spam or abuse.

### Testing and network planning
- Use reliable faucets or pre-funded test wallets.
- Estimate gas requirements and plan token distribution in advance.

### User experience and error handling
- Provide clear and actionable error messages.
