// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title FreelanceEscrow is smart contract that allows a client and a freelancer to collaborate safely.
 * The client creates a deal and deposits funds into the contract.
 * Once the freelancer completes the work, the client approves it, and the payment is automatically released.
 */

contract FreelanceEscrow is ReentrancyGuard, Ownable, Pausable {
    using Counters for Counters.Counter;

    struct Deal {
        uint dealId;
        address client;
        address freelancer;
        uint amount;
        uint workDeadline; //час коли робота має бути виконана
        uint releaseTime; //час коли можна зняти гроші, мінімум 2 тиж
        bool approved;
        bool paid;
        bool disputed;
        string disputeReason;
        address arbitrator;
    }

    Counters.Counter private _dealId;

    mapping(uint => Deal) public deals;

    error InvalidAddress();
    error InvalidAmount();
    error InvalidId();
    error AlreadyApproved();
    error NotAuthorized();
    error NotApproved();
    error TimeIsLocked();
    error AlreadyPaid();
    error TimeNotFinished();
    error NotDisputed();

    event DealCreated(
        uint dealId,
        uint amount,
        address indexed client,
        address indexed freelancer
    );
    event DealApproved(uint id, address indexed client);
    event CancelDeal(uint id, address indexed client);
    event DisputeRaised(
        uint id,
        address indexed reaisedBy,
        address indexed against,
        string reason
    );
    event DisputeResolved(uint id, address winner);

    function createDeal(
        address _freelancer,
        uint durationTime
    ) external payable whenNotPaused nonReentrant {
        if (_freelancer == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert InvalidAmount();

        _dealId.increment();
        uint currentId = _dealId.current();

        uint _workDeadline = block.timestamp + durationTime;
        uint releaseTime = block.timestamp + 14 days;

        deals[currentId] = Deal({
            dealId: currentId,
            client: msg.sender,
            freelancer: _freelancer,
            amount: msg.value,
            workDeadline: _workDeadline,
            releaseTime: releaseTime,
            approved: false,
            paid: false,
            disputed: false,
            disputeReason: "",
            arbitrator: address(0)
        });

        emit DealCreated(currentId, msg.value, msg.sender, _freelancer);
    }
    function approveWork(uint _currentId) external {
        if (_currentId == 0 || _currentId > _dealId.current())
            revert InvalidId();
        Deal storage deal = deals[_currentId];
        if (msg.sender != deal.client) revert NotAuthorized();
        if (deal.approved) revert AlreadyApproved();

        deal.approved = true;

        emit DealApproved(_currentId, msg.sender);
    }
    function releasePayment(uint _currentId) external nonReentrant {
        Deal storage deal = deals[_currentId];
        if (!deal.approved) revert NotApproved();
        if (block.timestamp < deal.releaseTime) revert TimeIsLocked();
        if (msg.sender != deal.freelancer) revert NotAuthorized();
        if (deal.paid) revert AlreadyPaid();

        deal.paid = true;
        (bool send, ) = msg.sender.call{value: deal.amount}("");
        require(send, "Failed to send amount");
    }
    function cancelDeal(uint _currentId) external nonReentrant {
        Deal storage deal = deals[_currentId];
        if (msg.sender != deal.client) revert NotAuthorized();
        if (deal.approved || deal.paid) revert AlreadyApproved();
        if (deal.workDeadline > block.timestamp) revert TimeNotFinished();
        deal.paid = true;
        (bool send, ) = msg.sender.call{value: deal.amount}("");
        require(send, "Failed to send money");
        emit CancelDeal(_currentId, msg.sender);
    }
    function raiseDispute(uint _currentId, string calldata _reason) external {
        Deal storage deal = deals[_currentId];
        if (msg.sender != deal.client && msg.sender != deal.freelancer)
            revert NotAuthorized();
        if (deal.paid || deal.disputed) revert AlreadyPaid();
        address opponent = (msg.sender == deal.client)
            ? deal.freelancer
            : deal.client;

        deal.disputed = true;
        deal.disputeReason = _reason;
        deal.arbitrator = owner();

        emit DisputeRaised(_currentId, msg.sender, opponent, _reason);
    }
    function resolveDispute(
        uint _currentId,
        bool refundToClient
    ) external onlyOwner nonReentrant {
        Deal storage deal = deals[_currentId];
        if (!deal.disputed) revert NotDisputed();
        if (deal.paid) revert AlreadyPaid();

        deal.paid = true;
        deal.disputed = false;
        address receiver = refundToClient ? deal.client : deal.freelancer;
        (bool sent, ) = receiver.call{value: deal.amount}("");
        require(sent, "Transfer failed");

        emit DisputeResolved(_currentId, receiver);
    }
    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }
}
