// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
/**
 * @title Crowdsale Contract
 * @notice Multi-round token sale contract for TAR token distribution
 * @dev Manages token sales across multiple rounds with different rates and conditions.
 *      Integrates with TarToken (ERC20) and Treasury contracts.
 *      Supports whitelist, individual caps, soft/hard caps, and refund mechanism.
 *      Features:
 *      - Multiple sales rounds with customizable parameters
 *      - Whitelist support for private rounds
 *      - Individual and global contribution limits
 *      - Automatic hardcap enforcement
 *      - Refund mechanism if softcap not reached
 * @author Tariielashvili O.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface ITreasury {
    function depositETH() external payable;
    function withdrawETH(address payable to, uint256 amount) external;
}

contract Crowdsale is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    ITreasury public treasury;
    using Address for address payable;

    //errors
    error ZeroAddress();
    error InvalidIndividualCap();
    error InvalidAmount();
    error InvalidRate();
    error ExceedsMaxHardCap();
    error InvalidTimeRanged();
    error InvalidId();
    error TooEarlyForRound();
    error RoundNotExist();
    error NoActiveRound();
    error RoundNotActive();
    error TooSmallAmount();
    error TooBigAmount();
    error RoundHardCapReached();
    error GlobalHardCapReached();
    error IndividualCapExceeded();
    error AlreadyActive();
    error NotWhitelisted();
    error RoundStillActive();
    error AlreadyFinalized();
    error SaleNotFinalized();
    error SoftCapReached();
    error NoContribution();

    //events
    event RoundCreated(
        uint256 indexed totalRounds,
        uint256 rate,
        uint256 hardCap,
        uint256 startTime,
        uint256 endTime
    );
    event RoundActivated(uint256 indexed id);
    event WhitelistUpdated(address indexed user, bool active);
    event TokensPurchased(
        address indexed buyer,
        uint256 indexed roundId,
        uint256 ethAmount,
        uint256 tokenAmount
    );
    event RoundCompleted(uint256 indexed roundId, uint256 totalRaised);
    event SaleFinalized(uint256 totalRaised, bool successful);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event EmergencyWithdrawal(uint256 amount);
    event IndividualCapUpdated(uint256 newCap);
    event SoftCapUpdated(uint256 newSoftCap);

    //state variables
    /**
     * @notice Immutable contract addresses and constant limits
     * @dev TOKEN - Address of the TAR token contract (set in constructor)
     * @dev TREASURY - Address where raised ETH is sent (set in constructor)
     * @dev MAX_HARDCAP - Maximum total ETH across all rounds (1000 ETH)
     * @dev MIN_SOFTCAP - Minimum allowed softcap value (100 ETH)
     * @dev MAX_INDIVIDUAL_CAP - Maximum per-address contribution (10 ETH)
     * @dev MIN_RATE - Minimum exchange rate, TAR per 1 ETH (1000)
     * @dev MAX_RATE - Maximum exchange rate, TAR per 1 ETH (20000)
     *
     * @notice Configurable sale parameters
     * @dev individualCap - Current per-address contribution limit (updatable by owner)
     * @dev softCap - Minimum ETH for successful sale, enables refunds if not met
     *
     * @notice Sale state tracking
     * @dev totalRaised - Total ETH raised across all rounds
     * @dev saleFinished - Whether sale has been finalized
     * @dev currentRound - ID of currently active round (0 = none)
     * @dev totalRounds - Total number of rounds created
     */

    address public immutable TOKEN;
    address public immutable TREASURY;

    uint256 public constant MAX_HARDCAP = 1000 ether;
    uint256 public constant MIN_SOFTCAP = 100 ether;
    uint256 public constant MAX_INDIVIDUAL_CAP = 10 ether;
    uint256 public constant MIN_RATE = 1000;
    uint256 public constant MAX_RATE = 20000;

    uint256 public individualCap;
    uint256 public softCap;
    uint256 public totalRaised;
    bool public saleFinished;
    uint256 public currentRound;
    uint256 public totalRounds;

    //struct
    /**
     * @notice Stores configuration and state for a single sale round
     * @dev Each round has independent parameters and contribution tracking
     * @param rate Number of TAR tokens per 1 ETH
     * @param hardCap Maximum ETH that can be raised in this round
     * @param minBuy Minimum ETH amount per single purchase
     * @param maxBuy Maximum ETH amount per single purchase
     * @param raised Total ETH already raised in this round
     * @param timeStart Timestamp when round begins
     * @param timeEnd Timestamp when round ends
     * @param whitelistOnly If true, only whitelisted addresses can participate
     * @param active Whether this round is currently active for purchases
     */
    struct Round {
        uint256 rate;
        uint256 hardCap;
        uint256 minBuy;
        uint256 maxBuy;
        uint256 raised;
        uint256 timeStart;
        uint256 timeEnd;
        bool whitelistOnly;
        bool active;
    }
    /**
     * @notice Tracks contribution and token allocation for each investor
     * @param totalContributed Total ETH contributed by this address across all rounds
     * @param tokensReceived Total TAR tokens received by this address
     * @param lastPurchaseTime Timestamp of the most recent token purchase
     */
    struct Investor {
        uint256 totalContributed;
        uint256 tokensReceived;
        uint256 lastPurchaseTime;
    }
    mapping(uint256 => Round) public rounds;
    mapping(address => Investor) public investors;
    mapping(address => bool) public whitelist;

    //constructor
    /**
     * @notice Initializes the Crowdsale contract
     * @dev Sets immutable addresses and validates initial parameters
     * @param _token Address of the TAR token (ERC20) contract
     * @param _treasury Address where raised ETH will be sent
     * @param _individualCap Maximum ETH contribution per address (must be <= MAX_INDIVIDUAL_CAP)
     * @param _softCap Minimum ETH to raise for success (must be >= MIN_SOFTCAP and <= MAX_HARDCAP)
     */
    constructor(
        address _token,
        address _treasury,
        uint256 _individualCap,
        uint256 _softCap
    ) Ownable(msg.sender) {
        if (_token == address(0) || _treasury == address(0))
            revert ZeroAddress();
        if (_individualCap == 0 || _individualCap > MAX_INDIVIDUAL_CAP)
            revert InvalidIndividualCap();
        if (_softCap < MIN_SOFTCAP || _softCap > MAX_HARDCAP)
            revert InvalidAmount();

        TOKEN = _token;
        TREASURY = _treasury;
        treasury = ITreasury(_treasury);
        individualCap = _individualCap;
        softCap = _softCap;
    }
    /**
    * @notice Creates a new sale round with specified parameters
    * @dev Can only be called by owner when not paused
    *      Validates that sum of all round hardcaps doesn't exceed MAX_HARDCAP
    NOTE: Gas optimization possible - replace for loop with hardCapsPerRounds variable
    *      Round is created inactive and must be activated separately via activateRound()
    * @param _rate Exchange rate - number of TAR tokens per 1 ETH (must be between MIN_RATE and MAX_RATE)
    * @param _hardCap Maximum ETH this round can raise
    * @param _minBuy Minimum ETH per purchase transaction
    * @param _maxBuy Maximum ETH per purchase transaction
    * @param _startTime Unix timestamp when round becomes valid
    * @param _endTime Unix timestamp when round expires
    * @param _whitelistOnly If true, only whitelisted addresses can participate
 */
    function createRound(
        uint256 _rate,
        uint256 _hardCap,
        uint256 _minBuy,
        uint256 _maxBuy,
        uint256 _startTime,
        uint256 _endTime,
        bool _whitelistOnly
    ) external onlyOwner whenNotPaused {
        if (_rate == 0) revert InvalidRate();
        if (_rate < MIN_RATE || _rate > MAX_RATE) revert InvalidRate();

        uint256 hardCapsPerRounds = 0;
        for (uint256 i = 1; i <= totalRounds; i++) {
            hardCapsPerRounds += rounds[i].hardCap;
        }
        if (hardCapsPerRounds + _hardCap > MAX_HARDCAP)
            revert ExceedsMaxHardCap();
        if (_startTime >= _endTime) revert InvalidTimeRanged();
        if (block.timestamp > _startTime) revert InvalidTimeRanged();
        if (_minBuy > _maxBuy) revert InvalidAmount();

        totalRounds++;

        rounds[totalRounds] = Round({
            rate: _rate,
            hardCap: _hardCap,
            minBuy: _minBuy,
            maxBuy: _maxBuy,
            raised: 0,
            timeStart: _startTime,
            timeEnd: _endTime,
            whitelistOnly: _whitelistOnly,
            active: false
        });

        emit RoundCreated(totalRounds, _rate, _hardCap, _startTime, _endTime);
    }

    /**
     * @notice Activates a specific round for token purchases
     * @dev Only one round can be active at a time.
     *      Automatically deactivates the previously active round (if any).
     * @param _id ID of the round to activate (only owner)
     */
    function activateRound(uint256 _id) external onlyOwner whenNotPaused {
        if (_id == 0) revert InvalidId();
        if (_id > totalRounds) revert InvalidId();

        Round storage round = rounds[_id];
        if (round.timeStart > block.timestamp) revert TooEarlyForRound();
        if (round.hardCap == 0) revert RoundNotExist();
        if (round.active) revert AlreadyActive();
        if (currentRound != 0) {
            rounds[currentRound].active = false; //deactivate previous round
        }

        round.active = true;
        currentRound = _id;

        emit RoundActivated(_id);
    }

    /**
     * @notice Adds multiple addresses to the whitelist
     * @param users Array of addresses to add
     */
    function addToWhiteList(
        address[] calldata users
    ) external onlyOwner whenNotPaused {
        if (users.length == 0) revert InvalidAmount();
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) revert ZeroAddress();

            whitelist[users[i]] = true;
            emit WhitelistUpdated(users[i], true);
        }
    }
    //@notice remove multiple addresses from the whitelist
    function removeFromWhiteList(
        address[] calldata users
    ) external onlyOwner whenNotPaused {
        if (users.length == 0) revert InvalidAmount();
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == address(0)) revert ZeroAddress();

            whitelist[users[i]] = false;
            emit WhitelistUpdated(users[i], false);
        }
    }

    /**
     * @notice Purchase tokens with ETH
     */
    function buyTokens() external payable nonReentrant whenNotPaused {
        if (currentRound == 0) revert NoActiveRound();
        Round storage round = rounds[currentRound];

        if (!round.active) revert RoundNotActive();
        if (block.timestamp < round.timeStart) revert InvalidTimeRanged();
        if (block.timestamp > round.timeEnd) revert InvalidTimeRanged();
        if (msg.value == 0) revert InvalidAmount();
        if (msg.value < round.minBuy) revert TooSmallAmount();
        if (msg.value > round.maxBuy) revert TooBigAmount();
        if (round.whitelistOnly && !whitelist[msg.sender])
            revert NotWhitelisted();
        if (round.raised + msg.value > round.hardCap)
            revert RoundHardCapReached();
        if (totalRaised + msg.value > MAX_HARDCAP)
            revert GlobalHardCapReached();

        uint256 tokenForSend = msg.value * round.rate;

        Investor storage investor = investors[msg.sender];
        if (investor.totalContributed + msg.value > individualCap)
            revert IndividualCapExceeded();

        investor.totalContributed += msg.value;
        investor.tokensReceived += tokenForSend;
        investor.lastPurchaseTime = block.timestamp;

        treasury.depositETH{value: msg.value}();

        round.raised += msg.value;
        totalRaised += msg.value;

        IERC20(TOKEN).safeTransfer(msg.sender, tokenForSend);

        emit TokensPurchased(msg.sender, currentRound, msg.value, tokenForSend);
        if (round.raised >= round.hardCap) {
            round.active = false;
            emit RoundCompleted(currentRound, round.raised);
        }
    }

    /**
     * @notice Finalizes the crowdsale
     * @dev Checks if softCap reached and sends ETH to Treasury or enables refunds
     */
    function finalizeSale() external onlyOwner nonReentrant whenNotPaused {
        if (saleFinished) revert AlreadyFinalized();
        if (currentRound != 0 && rounds[currentRound].active)
            revert RoundStillActive();

        saleFinished = true;

        if (totalRaised >= softCap) {
            emit SaleFinalized(totalRaised, true);
        } else {
            emit SaleFinalized(totalRaised, false);
        }
    }

    /**
     * @notice Allows investors to get refund if softCap not reached
     */
    function refund() external nonReentrant {
        if (!saleFinished) revert SaleNotFinalized();
        if (totalRaised >= softCap) revert SoftCapReached();

        Investor storage investor = investors[msg.sender];
        uint256 contribution = investor.totalContributed;

        if (contribution == 0) revert NoContribution();

        investor.totalContributed = 0;

        treasury.withdrawETH(payable(msg.sender), contribution);

        emit Refunded(msg.sender, contribution);
    }

    /**
     * @notice Updates the individual contribution cap
     * @param newCap New individual cap value
     */
    function setIndividualCap(uint256 newCap) external onlyOwner {
        if (newCap == 0) revert InvalidAmount();
        if (newCap > MAX_INDIVIDUAL_CAP) revert InvalidAmount();

        individualCap = newCap;
        emit IndividualCapUpdated(newCap);
    }

    /**
     * @notice Updates the soft cap
     * @param newSoftCap New soft cap value
     */
    function setSoftCap(uint256 newSoftCap) external onlyOwner {
        if (newSoftCap < MIN_SOFTCAP) revert InvalidAmount();
        if (newSoftCap > MAX_HARDCAP) revert InvalidAmount();

        softCap = newSoftCap;
        emit SoftCapUpdated(newSoftCap);
    }

    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }

    function getInvestorInfo(
        address user
    )
        external
        view
        returns (
            uint256 totalContributed,
            uint256 tokensReceived,
            uint256 lastPurchaseTime,
            bool isWhitelisted
        )
    {
        Investor memory investor = investors[user];
        return (
            investor.totalContributed,
            investor.tokensReceived,
            investor.lastPurchaseTime,
            whitelist[user]
        );
    }
}
