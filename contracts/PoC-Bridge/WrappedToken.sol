// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title WrappedToken1
/// @notice ERC20 wrapped token for cross-chain bridge
/// @dev Only BRIDGE_ROLE can mint/burn tokens
contract WrappedToken1 is ERC20, AccessControl {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // Events for tracking
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Mint wrapped tokens (called by bridge after Base deposit)
    /// @param to Recipient address
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /// @notice Burn tokens from a specific address. Only callable by BRIDGE_ROLE
    /// @param from Address from which tokens will be burned
    /// @param amount Number of tokens to burn
    function burn(address from, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
}
