# PoC Bridge Project

This is my Proof-of-Concept (PoC) project for moving tokens between two blockchains.

## Goal

The project shows a simple “bridge” logic for tokens between two blockchains without any currency exchange.

## How it works

1. **Blockchain A (Base Sepolia)**  
   - The user has some `Token1`.  
   - The user locks some tokens in the `TokenConsumer` contract.

2. **Bridge / message**  
   - After locking, a message with the amount goes through the bridge to blockchain B.
   Bridge / message
	- TokenConsumer (on chain A) and VirtualBalanceVault (on chain B) are the contracts that interact with Avail to transmit messages and tokens between chains.
	- After tokens are locked in TokenConsumer, a message with the amount is sent through the bridge to VirtualBalanceVault.

3. **Blockchain B (Polygon Amoy)**  
   - The `VirtualBalanceVault` contract receives the message and gives the user the same amount of tokens on this chain.  
   - The user will just see in the app that their balance on chain A went down and the balance on chain B went up.

## Contracts

- `Token1.sol` – a simple ERC-20 token.  
- `TokenConsumer.sol` – contract on chain A to lock tokens.  
- `VirtualBalanceVault.sol` – contract on chain B to track and give tokens to users

## Scripts

- `deployToken.js` – deploys the token.  
- `deployConsumer.js` – deploys TokenConsumer.  
- `deployVirtualBalanceVault.js` – deploys VirtualBalanceVault.  
- `interactPoC.js` – example of user interacting with the contracts.

---
