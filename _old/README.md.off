# TAR Ecosystem Smart Contracts

TAR DeFi Ecosystem (Work in Progress)

This repository contains the core smart contracts of the TAR DeFi ecosystem.
The goal of the project is to build a simple, modular, and transparent token-based system that includes:

• TAR Token (ERC-20)

A fixed-supply token used as the main asset inside the ecosystem.
It serves as the currency sold during the Crowdsale and later can be transferred into staking, vesting, rewards, or future modules.

• Treasury Contract

A central vault responsible for holding ETH and TAR tokens.
In the final architecture, the Treasury will work as the main financial hub:
• receives ETH from the Crowdsale (after successful finalization)
• stores tokens and ETH for future protocol components
• interacts only with authorized contracts (not directly with end-users)

• Crowdsale Contract

A multi-round token sale mechanism with customizable parameters such as:
• rates per round
• min/max buy limits
• individual caps
• whitelist support
• round-based hard caps
• global hard cap
• soft cap and refund logic

ETH collected during the sale does not go directly to the owner;
instead, after successful completion, all raised ETH is transferred to the Treasury, keeping the separation between sale logic and fund storage.

This separation of responsibilities makes the system more maintainable and closer to real DeFi architecture, where token sale, fund storage, and utility modules are cleanly separated.

## 📂 Structure

System Logic Overview 1. Users buy TAR tokens in Crowdsale → ETH temporarily stays inside the Crowdsale until finalization → Tokens are transferred to buyers (current version) or locked (future version). 2. When the softCap is reached and all rounds end → Crowdsale finalizes the sale → All accumulated ETH is sent into the Treasury contract. 3. The Treasury becomes the financial layer. Future modules (staking, vesting, governance, savings pools) will operate against it:
• pulling TAR/ETH from Treasury through controlled, authorized functions
• ensuring secure and isolated fund management

## Personal Notes

These are my own notes about things I want to improve in the future:

1. Token distribution during Crowdsale

Right now buyers receive tokens immediately after each purchase.
It works, but it’s not ideal for a real token sale.

If the softCap is not reached, buyers can refund ETH, but they still keep the tokens.
Later I want to implement a system where purchased tokens are locked and released only after finalizeSale() confirms success.

2. HardCap aggregation

I’m currently calculating total hardCap for all rounds using a loop.
I think it would be better to replace this with a dedicated variable to reduce gas usage and simplify the logic.

3. Additional modules planned

## Deployment

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```
