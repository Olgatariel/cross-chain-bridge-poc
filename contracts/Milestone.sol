// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract Milestone is Ownable, ReentrancyGuard, Pausable {
    // ----------------------
    // Custom Errors
    // ----------------------
    error InvalidAmount();
    error NotAuthorized();
    error AlreadyCompleted();
    error NoFundsToRefund();

    // ----------------------
    // Events
    // ----------------------
    event MilestoneCreated(uint indexed id, string description, uint amount);
    event MilestoneCompleted(uint indexed id);
    event Refunded(address indexed user, uint amount);

    // ----------------------
    // Struct
    // ----------------------
    struct Step {
        string description;
        uint amount;
        bool completed;
    }

    // ----------------------
    // State Variables
    // ----------------------
    mapping(uint => Step) public milestones;
    mapping(address => uint) public deposits;
    uint public nextId;

    // ----------------------
    // Modifiers
    // ----------------------
    modifier onlyPositive(uint _amount) {
        if (_amount == 0) revert InvalidAmount();
        _;
    }

    // ----------------------
    // Functions
    // ----------------------

    function createMilestone(
        string memory _description,
        uint _amount
    ) external onlyOwner onlyPositive(_amount) {
        milestones[nextId] = Step({
            description: _description,
            amount: _amount,
            completed: false
        });

        emit MilestoneCreated(nextId, _description, _amount);
        nextId++;
    }

    function completeMilestone(uint _id) external onlyOwner {
        Step storage step = milestones[_id];
        if (step.completed) revert AlreadyCompleted();
        step.completed = true;

        emit MilestoneCompleted(_id);
    }

    function deposit() external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        deposits[msg.sender] += msg.value;
    }

    function refund(uint _amount) external nonReentrant whenNotPaused {
        uint balance = deposits[msg.sender];
        if (balance < _amount || balance == 0) revert NoFundsToRefund();

        deposits[msg.sender] -= _amount;
        payable(msg.sender).transfer(_amount);

        emit Refunded(msg.sender, _amount);
    }

    // ----------------------
    // Emergency pause
    // ----------------------
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
