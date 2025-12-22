// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Locks tokens on Base for bridging
contract TokenConsumer {

    //errors
    error ZeroAmount();
    error InvalidDestination();
    error TransferFailed();

    //events
    /// @notice Emitted when user locks tokens for bridge transfer
    event DepositIntent(
        address indexed user,
        uint256 amount,
        uint256 destinationChainId
    );

    //state variables
    IERC20 public immutable token;

    //structs
    /// @notice Tracks each deposit with target chain
    struct Deposit {
        uint256 amount;
        uint256 destinationChainId;
    }
    mapping(address => Deposit[]) public deposits;

    //constructor
    constructor(address tokenAddress) {
        token = IERC20(tokenAddress);
    }

    //functions
    /// @notice Lock tokens and emit event for relayer
    function deposit(
        uint256 amount,
        uint256 destinationChainId
    ) external {
        if (amount == 0) revert ZeroAmount();
        if (destinationChainId == 0) revert InvalidDestination();
        bool success = token.transferFrom(
            msg.sender,
            address(this),
            amount
        );
        if (!success) revert TransferFailed();
        deposits[msg.sender].push(
            Deposit({
                amount: amount,
                destinationChainId: destinationChainId
            })
        );
        emit DepositIntent(msg.sender, amount, destinationChainId);
    }
    
    /// @notice Total tokens locked in contract
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
    
    function getDepositsCount(address user)
        external
        view
        returns (uint256)
    {
        return deposits[user].length;
    }
    
    function getDeposit(
        address user,
        uint256 index
    ) external view returns (Deposit memory) {
        return deposits[user][index];
    }
}