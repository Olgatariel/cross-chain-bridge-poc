TimeLockedWallet

This is my learning project in Solidity.
It is a simple smart contract that lets a user deposit ETH and withdraw it only after a specific time.

⸻

💡 Idea

I wanted to practice how time works in smart contracts.
The main idea is very simple: 1. A user sends some ETH to the contract. 2. Sets the time when it can be unlocked. 3. If the time is not reached yet → you cannot withdraw. 4. If the time has passed → you can withdraw your ETH.

I used this project to learn about block.timestamp, mapping, events, and how to test time with Hardhat.

⸻

⚙️ Functions
• createDeposit(uint unlockTime) — creates a deposit (must be in the future).
• withdrawDeposit(uint index) — lets you withdraw after the unlock time.

Custom errors for checks:
• StillLocked — time not reached.
• AlreadyWithdrawn — funds already taken.
• InvalidIndex — wrong deposit index.

⸻

🧪 Tests (Hardhat)

I wrote simple unit tests to cover main cases: 1. Deposit is created and emits DepositCreated. 2. Withdrawal before unlock time → reverts with StillLocked. 3. Successful withdrawal after unlock time → emits Withdrawn. 4. Second withdrawal → reverts with AlreadyWithdrawn.

⸻

🧰 Tools and tech
• Solidity ^0.8.20
• Hardhat
• Chai + Ethers.js
• @nomicfoundation/hardhat-toolbox (for time control)

⸻

🚀 How to run
npm install
npx hardhat compile
npx hardhat test
