// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
/**
 * @title Treasury Contract
 * @notice Handles storage and transfers of ETH and TAR tokens inside the DeFi ecosystem.
 * @dev Acts as a central bank for funds; interacts with authorized contracts such as Staking, Vesting, and Crowdsale.
 * @author Tariielashvili O.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Treasury is ReentrancyGuard, Ownable, Pausable {
    //events
    event TokensDeposited(address indexed from, uint256 amount);
    event TokensWithdrawn(address indexed to, uint256 amount);
    event EthDeposited(address indexed from, uint256 amount);
    event EthWithdrawn(address indexed to, uint256 amount);
    event UnknownDataReceived(address indexed user, uint256 amount);
    event AuthorizedChanged(address indexed to, bool status);

    //errors
    error InvalidAmount();
    error InvalidAddress();
    error NotEnoughETH();
    error NotEnoughTokens();
    error ExceedMaxETHlimits();
    error ExceedMaxTARlimits();

    //State variables
    ///@dev Can be updated by the Owner
    ///@dev The maximum deposit amount
    uint256 public maxTARperTx = 100 * 10 ** 18;
    uint256 public maxETHperTx = 100 ether;

    //structura,mapping
    IERC20 public token;
    using SafeERC20 for IERC20;

    /// @notice Stores addresses of authorized contracts allowed to interact with Treasury
    mapping(address => bool) public isAuthorized;

    // modifiers
    /// @dev Restricts access to owner and authorized contracts (like Staking or Vesting)
    modifier onlyAuthorized() {
        require(
            isAuthorized[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    /// @param _token Address of the TAR token contract used by Treasury
    /// @dev Initializes Treasury with ERC20 token address
    //constructor
    constructor(
        address _token
    ) Ownable(msg.sender) ReentrancyGuard() Pausable() {
        if (_token == address(0)) revert InvalidAddress();
        token = IERC20(_token);
    }

    //Core functions
    //ETH
    /// @notice Handles plain ETH transfers sent directly to the contract
    /// @dev Triggered when ETH is sent without data and no function is called
    receive() external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (msg.value > maxETHperTx) revert ExceedMaxETHlimits();
        emit EthDeposited(msg.sender, msg.value);
    }

    /// @notice Allows users to deposit ETH explicitly via function call
    /// @dev Used for standard deposits through DApp interaction
    function depositETH() external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (msg.value > maxETHperTx) revert ExceedMaxETHlimits();
        emit EthDeposited(msg.sender, msg.value);
    }

    /// @notice Handles unexpected ETH transfers or unknown function calls
    /// @dev Fallback function for invalid or incorrect data payloads
    fallback() external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (msg.value > maxETHperTx) revert ExceedMaxETHlimits();
        emit UnknownDataReceived(msg.sender, msg.value);
    }

    ///@notice Withdraw ETH from Treasury
    ///@dev Can be called only by the owner or authorized contracts
    ///@param to Address that will receive ETH
    ///@param amount Amount of ETH to send

    function withdrawETH(
        address payable to,
        uint256 amount
    ) external onlyAuthorized whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (address(this).balance < amount) revert NotEnoughETH();
        Address.sendValue(to, amount);
        emit EthWithdrawn(to, amount);
    }

    //Token
    ///@notice Deposit TAR tokens
    ///@dev Can be called by any users
    ///@param amount Amount of TAR tokens
    function depositTokens(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        if (amount > maxTARperTx) revert ExceedMaxTARlimits();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit TokensDeposited(msg.sender, amount);
    }

    ///@notice Withdraw tokens from Treasury
    ///@dev Can be called only by the owner or authorized contracts
    ///@param to Address that will receive tokens
    ///@param amount Amount of tokens to send
    function withdrawTokens(
        address to,
        uint256 amount
    ) external onlyAuthorized whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 balance = token.balanceOf(address(this));
        if (balance < amount) revert NotEnoughTokens();
        if (to == address(0)) revert InvalidAddress();
        token.safeTransfer(to, amount);
        emit TokensWithdrawn(to, amount);
    }

    //Admin functions
    ///@notice Grants or revokes permission for another contract to interact with Treasury
    /// @dev Only the owner can call this function
    /// @param contractAddr Address of the contract to authorize
    /// @param status True to authorize, false to revoke
    function setAuthorized(
        address contractAddr,
        bool status
    ) external onlyOwner {
        isAuthorized[contractAddr] = status;
        emit AuthorizedChanged(contractAddr, status);
    }

    /// @notice Pauses all deposit and withdrawal operations
    /// @dev Can be used by the owner in case of an emergency
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resumes Treasury operations after being paused
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Updates maximum allowed deposit amounts for TAR tokens and ETH
    /// @dev Only the owner can change transaction limits
    /// @param _tar The new TAR token limit per transaction
    /// @param _eth The new ETH limit per transaction
    function setLimits(uint256 _tar, uint256 _eth) external onlyOwner {
        maxTARperTx = _tar;
        maxETHperTx = _eth;
    }

    /// @notice Returns the current ETH and TAR token balances held by the Treasury
    /// @return ethBalance The current ETH balance
    /// @return tokenBalance The current TAR token balance
    function getContractBalance()
        public
        view
        returns (uint256 ethBalance, uint256 tokenBalance)
    {
        ethBalance = address(this).balance;
        tokenBalance = token.balanceOf(address(this));
    }
}
