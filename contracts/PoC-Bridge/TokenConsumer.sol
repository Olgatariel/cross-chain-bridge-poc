// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TokenConsumer: locks tokens on Base chain for bridging
contract TokenConsumer is Ownable {
    
    // Errors
    error ZeroAmount();
    error InvalidDestination();
    error TransferFailed();
    error AlreadyProcessed();
    error NotRelayer();
    
    // Events
    /// @notice Emitted when user locks tokens for bridging
    event DepositIntent(address indexed user, uint256 amount, uint256 nonce);
    
    /// @notice Emitted when tokens are released back to user
    event ReleaseExecuted(address indexed user, uint256 amount, uint256 nonce);

    // State variables
    IERC20 public immutable token;
    address public relayer; // address allowed to call release

    uint256 public currentNonce; // tracks nonces for deposits
    mapping(uint256 => bool) public processedNonces; // replay protection

    // Constructor
   constructor(address tokenAddress) Ownable(msg.sender) {
    token = IERC20(tokenAddress);
    }

    // Modifier for onlyRelayer
    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    /// @notice Set the relayer address (only owner)
    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    /// @notice Lock tokens and emit event for relayer
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        bool success = token.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        currentNonce += 1;

        emit DepositIntent(msg.sender, amount, currentNonce);
    }

    /// @notice Release tokens back to user (only relayer)
    function release(address to, uint256 amount, uint256 nonce) external onlyRelayer {
        if (processedNonces[nonce]) revert AlreadyProcessed();
        if (to == address(0)) revert InvalidDestination();
        if (amount == 0) revert ZeroAmount();

        processedNonces[nonce] = true;

        bool success = token.transfer(to, amount);
        if (!success) revert TransferFailed();

        emit ReleaseExecuted(to, amount, nonce);
    }

    /// @notice Total tokens locked in contract
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}