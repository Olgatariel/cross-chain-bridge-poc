// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TimeLockedWallet is ReentrancyGuard {
    struct Deposit {
        uint depositSum;
        uint unlockTime;
        bool active;
    }

    mapping(address => Deposit[]) public allDeposits;

    event DepositCreated(address indexed owner, uint amount, uint unlockTime);
    event Withdrawn(address indexed owner, uint amount, uint index);

    error InvalidIndex();
    error StillLocked(uint unlockTime);
    error AlreadyWithdrawn();
    error NothingToWithdraw();

    function createDeposit(uint _unlockTime) external payable {
        if (_unlockTime <= block.timestamp) revert StillLocked(_unlockTime);
        require(msg.value > 0, "Send some ETH");
        Deposit memory newDeposit = Deposit({
            depositSum: msg.value,
            unlockTime: _unlockTime,
            active: true
        });
        allDeposits[msg.sender].push(newDeposit);
        emit DepositCreated(msg.sender, msg.value, _unlockTime);
    }
    function withdrawDeposit(uint _index) external nonReentrant {
        if (_index >= allDeposits[msg.sender].length) revert InvalidIndex();
        Deposit storage dep = allDeposits[msg.sender][_index];

        if (block.timestamp < dep.unlockTime)
            revert StillLocked(dep.unlockTime);
        if (!dep.active) revert AlreadyWithdrawn();

        uint amount = dep.depositSum;
        if (amount == 0) revert NothingToWithdraw();

        dep.active = false;
        dep.depositSum = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send ETH");
        emit Withdrawn(msg.sender, amount, _index);
    }
}
