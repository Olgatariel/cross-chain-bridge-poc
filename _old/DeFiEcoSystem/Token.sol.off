// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title TarToken (TAR)
/// @notice ERC20 token with capped total supply and controlled minting.
/// @dev Only owner can mint,the total supply cannot exceed MAX_SUPPLY. Includes burn, Ownable, and Pausable.
contract TarToken is ERC20, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    error ExceedsMaxSupply();
    error ZeroAddress();

    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed user, uint256 amount);

    constructor() ERC20("TarToken", "TAR") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    function pause() public onlyOwner {
        _pause();
    }
    function unpause() public onlyOwner {
        _unpause();
    }
}
