// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VirtualBalanceVault {
    // Errors
    error ZeroAmount();
    error ZeroAddress();
    error NotRelayer();
    error InsufficientBalance(uint256 requested, uint256 available);

    // Events
    event BalanceCredited(address indexed user, uint256 amount, uint256 newBalance);
    event BalanceSpent(address indexed user, uint256 amount, uint256 newBalance);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    // State
    mapping(address => uint256) public virtualBalance;
    address public relayer;
    
    constructor(address _relayer) {
        if (_relayer == address(0)) revert ZeroAddress();
        relayer = _relayer;
    }
    
    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    /**
     * @notice Relayer credits virtual balance to user (called after verifying lock on chain A)
     * @param user User address to credit
     * @param amount Amount to credit
     */
    function credit(address user, uint256 amount) external onlyRelayer {
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        virtualBalance[user] += amount;
        emit BalanceCredited(user, amount, virtualBalance[user]);
    }

    /**
     * @notice User spends their virtual balance
     * @param amount Amount to spend
     */
    function spend(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        uint256 balance = virtualBalance[msg.sender];
        if (balance < amount) revert InsufficientBalance(amount, balance);
        
        virtualBalance[msg.sender] -= amount;
        emit BalanceSpent(msg.sender, amount, virtualBalance[msg.sender]);
    }
    
    /**
     * @notice Get virtual balance of user
     * @param user User address
     * @return Virtual balance
     */
    function getBalance(address user) external view returns (uint256) {
        return virtualBalance[user];
    }
    
    /**
     * @notice Update relayer address (only current relayer can call)
     * @param newRelayer New relayer address
     */
    function updateRelayer(address newRelayer) external onlyRelayer {
        if (newRelayer == address(0)) revert ZeroAddress();
        
        address oldRelayer = relayer;
        relayer = newRelayer;
        emit RelayerUpdated(oldRelayer, newRelayer);
    }
}