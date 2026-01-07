// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Minimal interface of the wrapped ERC20 token used by the bridge
interface IWrappedToken {
    /// @notice Mints wrapped tokens
    /// @param to Recipient address
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external;

    /// @notice Burns wrapped tokens from a specific address
    /// @param from Address to burn tokens from
    /// @param amount Amount to burn
    function burn(address from, uint256 amount) external;
}

/// @notice Bridge contract responsible for minting and burning wrapped tokens
/// @dev Deployed on the destination chain (Polygon). Only BRIDGE_ROLE can execute mint/burn.
contract BridgeMintBurn is AccessControl {
    /// @notice Role allowed to perform bridge operations
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    /// @notice Wrapped ERC20 token managed by this bridge
    IWrappedToken public immutable wrappedToken;

    /// @notice Tracks processed deposit nonces from the source chain
    mapping(uint256 => bool) public processedDeposits;

    /// @notice Sequential nonce for finalized withdrawals to the source chain
    uint256 public withdrawNonce;

    /// @notice Emitted when wrapped tokens are minted after a source-chain deposit
    /// @param to Recipient of minted tokens
    /// @param amount Minted amount
    /// @param depositNonce Nonce of the source-chain deposit
    event WrappedMinted(
        address indexed to,
        uint256 amount,
        uint256 indexed depositNonce
    );

    /// @notice Emitted when wrapped tokens are burned and withdrawal is finalized
    /// @param user Address whose tokens were burned
    /// @param amount Burned amount
    /// @param withdrawNonce Sequential withdrawal nonce
    event WithdrawIntent(
        address indexed user,
        uint256 amount,
        uint256 indexed withdrawNonce
    );

    /// @notice Creates the bridge contract
    /// @param wrappedToken_ Address of the wrapped ERC20 token
    /// @param admin Address receiving admin and bridge roles
    constructor(address wrappedToken_, address admin) {
        require(wrappedToken_ != address(0), "Zero token address");
        require(admin != address(0), "Zero admin");

        wrappedToken = IWrappedToken(wrappedToken_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Mints wrapped tokens after verifying a deposit on the source chain
    /// @dev Each deposit nonce can be processed only once (replay protection)
    /// @param to Recipient address
    /// @param amount Amount to mint
    /// @param depositNonce Nonce of the source-chain deposit
    function mintWrapped(
        address to,
        uint256 amount,
        uint256 depositNonce
    ) external onlyRole(BRIDGE_ROLE) {
        require(to != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        require(!processedDeposits[depositNonce], "Deposit already processed");

        processedDeposits[depositNonce] = true;
        wrappedToken.mint(to, amount);

        emit WrappedMinted(to, amount, depositNonce);
    }

    /// @notice Requests a withdrawal of wrapped tokens back to the source chain
    /// @dev Tokens are burned immediately upon calling this function to prevent double-spending
    /// @param amount The amount of wrapped tokens to burn and withdraw
    function withdraw(uint256 amount) external {
        require(amount > 0, "Zero amount");

        // Burn the tokens from the caller immediately
        wrappedToken.burn(msg.sender, amount);

        emit WithdrawIntent(msg.sender, amount, withdrawNonce);
        withdrawNonce++;
    }
}
