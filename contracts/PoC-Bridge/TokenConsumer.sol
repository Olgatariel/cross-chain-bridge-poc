// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenConsumer {

    //errors
    error ZeroAmount();
    error InvalidDestination();
    error TransferFailed();

    //events
        event DepositIntent(
        address indexed user,
        uint256 amount,
        uint256 destinationChainId
    );

    //state variables
    IERC20 public immutable token;

    //structs
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
