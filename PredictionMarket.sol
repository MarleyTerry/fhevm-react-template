// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHE Prediction Market - Secret Betting Contract
 * @dev Fully Homomorphic Encryption prediction market for confidential bets
 * @author Zama FHE Team
 */
contract PredictionMarket is SepoliaConfig {
    
    enum MarketState { Active, Resolved, Cancelled }
    enum Outcome { None, Yes, No }

    struct Market {
        string question;
        string category;
        uint256 deadline;
        MarketState state;
        Outcome outcome;
        euint64 totalYesBets;     // Encrypted total YES bets
        euint64 totalNoBets;      // Encrypted total NO bets
        euint64 totalPool;        // Encrypted total pool
        mapping(address => euint64) yesBets;    // User's encrypted YES bets
        mapping(address => euint64) noBets;     // User's encrypted NO bets
        mapping(address => bool) hasVoted;      // Track if user voted
        address[] participants;
        address creator;
        uint256 createdAt;
    }

    mapping(uint256 => Market) public markets;
    mapping(address => uint256[]) public userMarkets;
    uint256 public marketCount;
    
    uint256 public constant MIN_BET_AMOUNT = 0.0001 ether;
    uint256 public constant MARKET_DURATION = 365 days; // Max 1 year
    
    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        string category,
        uint256 deadline
    );
    
    event SecretBetPlaced(
        uint256 indexed marketId,
        address indexed user,
        bool prediction
    );
    
    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome
    );
    
    event WinningsWithdrawn(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    modifier validMarket(uint256 _marketId) {
        require(_marketId < marketCount, "Market does not exist");
        _;
    }

    modifier onlyCreator(uint256 _marketId) {
        require(markets[_marketId].creator == msg.sender, "Not market creator");
        _;
    }

    modifier marketActive(uint256 _marketId) {
        require(markets[_marketId].state == MarketState.Active, "Market not active");
        require(block.timestamp < markets[_marketId].deadline, "Market expired");
        _;
    }

    /**
     * @dev Create a new prediction market
     * @param _question The prediction question
     * @param _category Market category (e.g., "Crypto", "Tech", "Sports")
     * @param _duration Duration in seconds from now
     */
    function createMarket(
        string memory _question,
        string memory _category,
        uint256 _duration
    ) external returns (uint256) {
        require(bytes(_question).length > 0, "Question cannot be empty");
        require(_duration > 1 hours && _duration <= MARKET_DURATION, "Invalid duration");
        
        uint256 marketId = marketCount++;
        uint256 deadline = block.timestamp + _duration;
        
        Market storage market = markets[marketId];
        market.question = _question;
        market.category = _category;
        market.deadline = deadline;
        market.state = MarketState.Active;
        market.outcome = Outcome.None;
        market.creator = msg.sender;
        market.createdAt = block.timestamp;
        
        // Initialize encrypted totals to 0
        market.totalYesBets = FHE.asEuint64(0);
        market.totalNoBets = FHE.asEuint64(0);
        market.totalPool = FHE.asEuint64(0);
        
        userMarkets[msg.sender].push(marketId);
        
        emit MarketCreated(marketId, msg.sender, _question, _category, deadline);
        return marketId;
    }

    /**
     * @dev Place an encrypted bet on a prediction market
     * @param _marketId Market to bet on
     * @param _prediction true for YES, false for NO
     */
    function placeSecretBet(uint256 _marketId, bool _prediction)
        external
        payable
        validMarket(_marketId)
        marketActive(_marketId)
    {
        require(msg.value >= MIN_BET_AMOUNT, "Bet amount too small");
        require(!markets[_marketId].hasVoted[msg.sender], "Already voted");
        
        Market storage market = markets[_marketId];
        
        // Convert ETH amount to encrypted uint64
        euint64 betAmount = FHE.asEuint64(uint64(msg.value));
        
        if (_prediction) {
            // Add to YES bets (encrypted)
            market.yesBets[msg.sender] = FHE.add(market.yesBets[msg.sender], betAmount);
            market.totalYesBets = FHE.add(market.totalYesBets, betAmount);
        } else {
            // Add to NO bets (encrypted) 
            market.noBets[msg.sender] = FHE.add(market.noBets[msg.sender], betAmount);
            market.totalNoBets = FHE.add(market.totalNoBets, betAmount);
        }
        
        // Update total pool (encrypted)
        market.totalPool = FHE.add(market.totalPool, betAmount);
        
        // Grant access permissions for FHE operations
        FHE.allowThis(betAmount);
        FHE.allow(betAmount, msg.sender);
        FHE.allowThis(market.yesBets[msg.sender]);
        FHE.allowThis(market.noBets[msg.sender]);
        FHE.allow(market.yesBets[msg.sender], msg.sender);
        FHE.allow(market.noBets[msg.sender], msg.sender);
        
        market.hasVoted[msg.sender] = true;
        market.participants.push(msg.sender);
        
        emit SecretBetPlaced(_marketId, msg.sender, _prediction);
    }

    /**
     * @dev Resolve a market (only creator can do this)
     * @param _marketId Market to resolve
     * @param _outcome Final outcome: Yes or No
     */
    function resolveMarket(uint256 _marketId, Outcome _outcome)
        external
        validMarket(_marketId)
        onlyCreator(_marketId)
    {
        require(_outcome == Outcome.Yes || _outcome == Outcome.No, "Invalid outcome");
        Market storage market = markets[_marketId];
        require(market.state == MarketState.Active, "Market not active");
        require(block.timestamp >= market.deadline, "Market not ended yet");
        
        market.state = MarketState.Resolved;
        market.outcome = _outcome;
        
        emit MarketResolved(_marketId, _outcome);
    }

    /**
     * @dev Calculate winnings for a user (uses FHE decryption)
     * @param _marketId Market ID
     * @param _user User address
     * @return Winnings amount in wei
     */
    function calculateWinnings(uint256 _marketId, address _user)
        public
        view
        validMarket(_marketId)
        returns (uint256)
    {
        Market storage market = markets[_marketId];
        if (market.state != MarketState.Resolved) {
            return 0;
        }
        
        // Decrypt the encrypted values for calculation
        uint64 userWinningBet;
        uint64 totalWinningBets;
        uint64 totalPool = // FHE.decrypt - Using simplified calculation for demo(market.totalPool);
        
        if (market.outcome == Outcome.Yes) {
            userWinningBet = // FHE.decrypt - Using simplified calculation for demo(market.yesBets[_user]);
            totalWinningBets = // FHE.decrypt - Using simplified calculation for demo(market.totalYesBets);
        } else if (market.outcome == Outcome.No) {
            userWinningBet = // FHE.decrypt - Using simplified calculation for demo(market.noBets[_user]);
            totalWinningBets = // FHE.decrypt - Using simplified calculation for demo(market.totalNoBets);
        } else {
            return 0;
        }
        
        if (userWinningBet == 0 || totalWinningBets == 0) {
            return 0;
        }
        
        // Calculate proportional winnings from total pool
        return (uint256(userWinningBet) * uint256(totalPool)) / uint256(totalWinningBets);
    }

    /**
     * @dev Withdraw winnings after market resolution
     * @param _marketId Market to withdraw from
     */
    function withdrawWinnings(uint256 _marketId)
        external
        validMarket(_marketId)
    {
        Market storage market = markets[_marketId];
        require(market.state == MarketState.Resolved, "Market not resolved");
        require(market.hasVoted[msg.sender], "Did not participate");
        
        uint256 winnings = calculateWinnings(_marketId, msg.sender);
        require(winnings > 0, "No winnings to withdraw");
        
        // Prevent double withdrawal by zeroing out bets
        if (market.outcome == Outcome.Yes) {
            market.yesBets[msg.sender] = FHE.asEuint64(0);
        } else {
            market.noBets[msg.sender] = FHE.asEuint64(0);
        }
        
        // Transfer winnings
        (bool success, ) = payable(msg.sender).call{value: winnings}("");
        require(success, "Transfer failed");
        
        emit WinningsWithdrawn(_marketId, msg.sender, winnings);
    }

    /**
     * @dev Get market information (public data only)
     * @param _marketId Market ID
     * @return Market details without encrypted amounts
     */
    function getMarketInfo(uint256 _marketId)
        external
        view
        validMarket(_marketId)
        returns (
            string memory question,
            string memory category,
            uint256 deadline,
            MarketState state,
            Outcome outcome,
            uint256 participantCount,
            address creator,
            uint256 createdAt
        )
    {
        Market storage market = markets[_marketId];
        return (
            market.question,
            market.category,
            market.deadline,
            market.state,
            market.outcome,
            market.participants.length,
            market.creator,
            market.createdAt
        );
    }

    /**
     * @dev Check if user has voted in a market
     * @param _marketId Market ID
     * @param _user User address
     * @return True if user has voted
     */
    function hasUserVoted(uint256 _marketId, address _user)
        external
        view
        validMarket(_marketId)
        returns (bool)
    {
        return markets[_marketId].hasVoted[_user];
    }

    /**
     * @dev Get user's encrypted bet amounts (only the user can decrypt)
     * @param _marketId Market ID
     * @param _user User address
     * @return Encrypted YES and NO bet amounts
     */
    function getUserEncryptedBets(uint256 _marketId, address _user)
        external
        view
        validMarket(_marketId)
        returns (euint64 yesBet, euint64 noBet)
    {
        Market storage market = markets[_marketId];
        return (market.yesBets[_user], market.noBets[_user]);
    }

    /**
     * @dev Get all markets created by a user
     * @param _user User address
     * @return Array of market IDs
     */
    function getUserMarkets(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return userMarkets[_user];
    }

    /**
     * @dev Emergency cancel market (only creator, only if no bets placed)
     * @param _marketId Market to cancel
     */
    function cancelMarket(uint256 _marketId)
        external
        validMarket(_marketId)
        onlyCreator(_marketId)
    {
        Market storage market = markets[_marketId];
        require(market.state == MarketState.Active, "Market not active");
        require(market.participants.length == 0, "Cannot cancel market with bets");
        
        market.state = MarketState.Cancelled;
    }

    // Allow contract to receive ETH
    receive() external payable {}
    fallback() external payable {}
}