# PoC Bridge Project

This is my Proof-of-Concept (PoC) project for moving tokens between two blockchains.

## Goal

The project shows a simple “bridge” logic for tokens between two blockchains without any currency exchange and demonstrates how a relayer and Avail Data Availability can be used for cross-chain messaging.

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
TokenConsumer (on chain A) and VirtualBalanceVault (on chain B) are the contracts involved in the bridge logic.

3. **Blockchain B (Polygon Amoy)**  
   - The VirtualBalanceVault contract receives the message via the relayer.
   - The user gets the same amount of tokens on this chain (as a virtual balance).
   - From the user perspective, the balance on chain A goes down and the balance on chain B goes up.

## Contracts

   - `Token1.sol` – a simple ERC-20 token.  
   - `TokenConsumer.sol` – contract on chain A to lock tokens and emit bridge events.  
   - `VirtualBalanceVault.sol` – contract on chain B to track and give tokens to users

## Relayer
   - The relayer is an off-chain script that connects both blockchains.
   - It listens to events on Base Sepolia, submits message data to Avail, and triggers contract calls on Polygon Amoy.

## Scripts

   - `deployToken.js` – deploys the token.  
   - `deployConsumer.js` – deploys TokenConsumer.  
   - `deployVirtualBalanceVault.js` – deploys VirtualBalanceVault.  
   - `interactPoC.js` – example of user interacting with the contracts.

## Architecture
```
User
  |
  | deposit(Token1)
  ▼
TokenConsumer
(Base Sepolia)
  |
  | DepositIntent event
  ▼
Relayer
  |
  | submit message
  ▼
Avail DA
  |
  | confirmation
  ▼
Relayer
  |
  | execute message
  ▼
VirtualBalanceVault
(Polygon Amoy)
```