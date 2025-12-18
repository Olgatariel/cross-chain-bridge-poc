# Cross-chain Bridge PoC

This repository contains a simple proof of concept for experimenting with
token interactions and preparing for cross-chain / bridge logic.

## Overview

The contracts in this project are intentionally minimal.
They are not production-ready and are designed only to demonstrate
basic token flow and contract-to-contract interaction.

The main focus is on future bridge integration rather than complex
token or business logic.

## Contracts

- `Token.sol` — simple ERC-20 token used as a test asset
- `TokenConsumer.sol` — contract that receives tokens via `transferFrom`

## Tests

Unit tests cover:
- token deployment and balances
- approve / allowance logic
- token deposit into the consumer contract
- failure scenarios (insufficient allowance / balance)

## Running tests

```bash
npm install
npx hardhat test