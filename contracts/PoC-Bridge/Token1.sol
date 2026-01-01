// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Token1
 * @author ---
 *
 * @notice
 * ERC-20 token deployed on Base chain and used as the original asset
 * for a bidirectional wrapped-token bridge (POC).
 *
 * @dev
 * This token represents the "source" asset in the bridge architecture.
 * Tokens are locked in a bridge contract on Base and unlocked when users
 * bridge back from the destination chain.
 *
 * The contract includes:
 * - A mint function restricted to the owner (for administrative and testing purposes)
 * - A faucet function to simplify testing in a POC environment
 *
 * @dev POC assumptions:
 * - Unlimited supply inflation is allowed
 * - Faucet is enabled for easier testnet usage
 * - This contract is NOT intended for production deployment
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token1 is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 100 * 10 ** 18;
    mapping(address => uint256) public lastClaim;

    constructor(
        uint256 initialSupply
    ) ERC20("Token1", "TKN1") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function claimFaucet() external {
        require(block.timestamp >= lastClaim[msg.sender] + 1 days, "Wait 24h");
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
