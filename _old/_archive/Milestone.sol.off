// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ----------------------
// Imports
// ----------------------
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

// ----------------------
// Contract
// ----------------------
contract Milestone is Ownable, ReentrancyGuard, Pausable {
    // ----------------------
    // Errors
    // ----------------------
    error InvalidAmount();
    error AlreadyCompleted();
    error NoFundsToRefund();
    error NotAuthorized();

    // ----------------------
    // Events
    // ----------------------
    event MilestoneCreated(uint indexed id, uint amount);
    event MilestoneCompleted(uint indexed id);
    event Refunded(address indexed user, uint amount);

    // ----------------------
    // Structs
    // ----------------------
    struct Task {
        uint id;
        uint amount;
        bool completed;
        address contributor;
    }

    // ----------------------
    // State Variables
    // ----------------------
    uint public nextId;
    mapping(uint => Task) public milestones;
    uint public totalBalance;

    // ----------------------
    // Modifiers
    // ----------------------
    modifier validAmount(uint _amount) {
        if (_amount == 0) revert InvalidAmount();
        _;
    }

    modifier notCompleted(uint _id) {
        if (milestones[_id].completed) revert AlreadyCompleted();
        _;
    }

    // ----------------------
    // Core Functions
    // ----------------------

    // Create a new milestone
    function createMilestone(
        uint _amount
    ) external payable whenNotPaused validAmount(_amount) {
        if (msg.value != _amount) revert InvalidAmount();

        milestones[nextId] = Task({
            id: nextId,
            amount: _amount,
            completed: false,
            contributor: msg.sender
        });

        totalBalance += msg.value;

        emit MilestoneCreated(nextId, _amount);
        nextId++;
    }

    // Mark a milestone as completed (only owner)
    function completeMilestone(
        uint _id
    ) external onlyOwner notCompleted(_id) whenNotPaused {
        milestones[_id].completed = true;
        emit MilestoneCompleted(_id);
    }

    // Refund ETH to contributor if milestone not completed
    function refund(uint _id) external nonReentrant whenNotPaused {
        Task storage task = milestones[_id];

        if (task.contributor != msg.sender) revert NotAuthorized();
        if (task.completed) revert AlreadyCompleted();
        if (task.amount == 0) revert NoFundsToRefund();

        uint _amount = task.amount;
        task.amount = 0;

        totalBalance -= _amount;
        payable(msg.sender).transfer(_amount);

        emit Refunded(msg.sender, _amount);
    }

    // ----------------------
    // Owner Functions
    // ----------------------

    // Withdraw all funds (only owner)
    function withdrawAll() external onlyOwner nonReentrant {
        uint balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        totalBalance = 0;
        payable(owner()).transfer(balance);
    }

    // Pause / Unpause (emergency control)
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ----------------------
    // View Functions
    // ----------------------

    function getMilestone(uint _id) external view returns (Task memory) {
        return milestones[_id];
    }

    function getContractBalance() external view returns (uint) {
        return address(this).balance;
    }
}
