const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PredictionMarket", function () {
  let predictionMarket;
  let owner, creator, bettor1, bettor2, bettor3;
  let MIN_BET, MAX_BET;

  beforeEach(async function () {
    // Get signers
    [owner, creator, bettor1, bettor2, bettor3] = await ethers.getSigners();

    // Deploy contract
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    predictionMarket = await PredictionMarket.deploy();
    await predictionMarket.waitForDeployment();

    // Get constants
    MIN_BET = await predictionMarket.MIN_BET();
    MAX_BET = await predictionMarket.MAX_BET();
  });

  describe("Deployment", function () {
    it("Should deploy with zero markets initially", async function () {
      const totalMarkets = await predictionMarket.getTotalMarkets();
      expect(totalMarkets).to.equal(0);
    });

    it("Should set correct MIN_BET and MAX_BET constants", async function () {
      expect(MIN_BET).to.equal(ethers.parseEther("0.001"));
      expect(MAX_BET).to.equal(ethers.parseEther("10"));
    });
  });

  describe("Market Creation", function () {
    it("Should create a market successfully", async function () {
      const question = "Will ETH reach $5000?";
      const duration = 7 * 24 * 60 * 60; // 7 days

      const tx = await predictionMarket.connect(creator).createMarket(question, duration);
      await expect(tx)
        .to.emit(predictionMarket, "MarketCreated")
        .withArgs(0, question, await time.latest() + duration + 1, creator.address);

      const totalMarkets = await predictionMarket.getTotalMarkets();
      expect(totalMarkets).to.equal(1);
    });

    it("Should create market with correct properties", async function () {
      const question = "Will BTC reach $100k?";
      const duration = 30 * 24 * 60 * 60; // 30 days

      await predictionMarket.connect(creator).createMarket(question, duration);

      const market = await predictionMarket.getMarket(0);
      expect(market.question).to.equal(question);
      expect(market.creator).to.equal(creator.address);
      expect(market.resolved).to.equal(false);
      expect(market.totalYesBets).to.equal(0);
      expect(market.totalNoBets).to.equal(0);
    });

    it("Should fail to create market with zero duration", async function () {
      const question = "Invalid market";
      const duration = 0;

      await expect(
        predictionMarket.connect(creator).createMarket(question, duration)
      ).to.be.revertedWith("Duration must be positive");
    });

    it("Should fail to create market with empty question", async function () {
      const question = "";
      const duration = 7 * 24 * 60 * 60;

      await expect(
        predictionMarket.connect(creator).createMarket(question, duration)
      ).to.be.revertedWith("Question cannot be empty");
    });

    it("Should allow multiple markets to be created", async function () {
      await predictionMarket.connect(creator).createMarket("Market 1", 1000);
      await predictionMarket.connect(creator).createMarket("Market 2", 2000);
      await predictionMarket.connect(creator).createMarket("Market 3", 3000);

      const totalMarkets = await predictionMarket.getTotalMarkets();
      expect(totalMarkets).to.equal(3);
    });
  });

  describe("Placing Bets", function () {
    beforeEach(async function () {
      // Create a market before each test
      const question = "Test market";
      const duration = 7 * 24 * 60 * 60;
      await predictionMarket.connect(creator).createMarket(question, duration);
    });

    it("Should place a bet successfully", async function () {
      const betAmount = ethers.parseEther("0.01");
      const prediction = true; // YES

      const tx = await predictionMarket.connect(bettor1).placeBet(0, prediction, {
        value: betAmount,
      });

      await expect(tx)
        .to.emit(predictionMarket, "BetPlaced")
        .withArgs(0, bettor1.address, betAmount);

      const betInfo = await predictionMarket.getBetExists(0);
      expect(betInfo.exists).to.equal(true);
      expect(betInfo.claimed).to.equal(false);
    });

    it("Should fail to bet below minimum amount", async function () {
      const betAmount = ethers.parseEther("0.0001"); // Below MIN_BET

      await expect(
        predictionMarket.connect(bettor1).placeBet(0, true, { value: betAmount })
      ).to.be.revertedWith("Invalid bet amount");
    });

    it("Should fail to bet above maximum amount", async function () {
      const betAmount = ethers.parseEther("15"); // Above MAX_BET

      await expect(
        predictionMarket.connect(bettor1).placeBet(0, true, { value: betAmount })
      ).to.be.revertedWith("Invalid bet amount");
    });

    it("Should fail to place bet on non-existent market", async function () {
      const betAmount = ethers.parseEther("0.01");

      await expect(
        predictionMarket.connect(bettor1).placeBet(99, true, { value: betAmount })
      ).to.be.revertedWith("Market does not exist");
    });

    it("Should fail to place bet twice from same address", async function () {
      const betAmount = ethers.parseEther("0.01");

      await predictionMarket.connect(bettor1).placeBet(0, true, { value: betAmount });

      await expect(
        predictionMarket.connect(bettor1).placeBet(0, false, { value: betAmount })
      ).to.be.revertedWith("Already placed bet");
    });

    it("Should allow multiple users to bet on same market", async function () {
      const bet1 = ethers.parseEther("0.01");
      const bet2 = ethers.parseEther("0.02");
      const bet3 = ethers.parseEther("0.015");

      await predictionMarket.connect(bettor1).placeBet(0, true, { value: bet1 });
      await predictionMarket.connect(bettor2).placeBet(0, false, { value: bet2 });
      await predictionMarket.connect(bettor3).placeBet(0, true, { value: bet3 });

      const bettors = await predictionMarket.getMarketBettors(0);
      expect(bettors.length).to.equal(3);
      expect(bettors).to.include(bettor1.address);
      expect(bettors).to.include(bettor2.address);
      expect(bettors).to.include(bettor3.address);
    });

    it("Should fail to bet on ended market", async function () {
      // Fast forward time past market end
      await time.increase(8 * 24 * 60 * 60); // 8 days

      const betAmount = ethers.parseEther("0.01");

      await expect(
        predictionMarket.connect(bettor1).placeBet(0, true, { value: betAmount })
      ).to.be.revertedWith("Market has ended");
    });
  });

  describe("Market Resolution", function () {
    beforeEach(async function () {
      const question = "Test market for resolution";
      const duration = 1 * 24 * 60 * 60; // 1 day
      await predictionMarket.connect(creator).createMarket(question, duration);

      // Place some bets
      await predictionMarket
        .connect(bettor1)
        .placeBet(0, true, { value: ethers.parseEther("0.01") });
      await predictionMarket
        .connect(bettor2)
        .placeBet(0, false, { value: ethers.parseEther("0.02") });
    });

    it("Should resolve market successfully after end time", async function () {
      // Fast forward past end time
      await time.increase(2 * 24 * 60 * 60);

      const outcome = true; // YES
      const tx = await predictionMarket.connect(creator).resolveMarket(0, outcome);

      await expect(tx).to.emit(predictionMarket, "MarketResolved").withArgs(0, outcome);

      const market = await predictionMarket.getMarket(0);
      expect(market.resolved).to.equal(true);
      expect(market.outcome).to.equal(outcome);
    });

    it("Should fail to resolve before end time", async function () {
      await expect(
        predictionMarket.connect(creator).resolveMarket(0, true)
      ).to.be.revertedWith("Market is still active");
    });

    it("Should fail to resolve if not creator", async function () {
      await time.increase(2 * 24 * 60 * 60);

      await expect(
        predictionMarket.connect(bettor1).resolveMarket(0, true)
      ).to.be.revertedWith("Only creator can resolve");
    });

    it("Should fail to resolve already resolved market", async function () {
      await time.increase(2 * 24 * 60 * 60);

      await predictionMarket.connect(creator).resolveMarket(0, true);

      await expect(
        predictionMarket.connect(creator).resolveMarket(0, false)
      ).to.be.revertedWith("Market already resolved");
    });

    it("Should fail to resolve non-existent market", async function () {
      await expect(
        predictionMarket.connect(creator).resolveMarket(99, true)
      ).to.be.revertedWith("Market does not exist");
    });
  });

  describe("Get Market Information", function () {
    it("Should return correct market information", async function () {
      const question = "Information test market";
      const duration = 5 * 24 * 60 * 60;

      await predictionMarket.connect(creator).createMarket(question, duration);

      const market = await predictionMarket.getMarket(0);
      expect(market.question).to.equal(question);
      expect(market.creator).to.equal(creator.address);
      expect(market.resolved).to.equal(false);
    });

    it("Should fail to get non-existent market", async function () {
      await expect(predictionMarket.getMarket(0)).to.be.revertedWith(
        "Market does not exist"
      );
    });

    it("Should return empty bettors array for new market", async function () {
      await predictionMarket.connect(creator).createMarket("Test", 1000);

      const bettors = await predictionMarket.getMarketBettors(0);
      expect(bettors.length).to.equal(0);
    });
  });

  describe("Emergency Withdraw", function () {
    beforeEach(async function () {
      const question = "Emergency test market";
      const duration = 1 * 24 * 60 * 60;
      await predictionMarket.connect(creator).createMarket(question, duration);

      // Place bet
      await predictionMarket
        .connect(bettor1)
        .placeBet(0, true, { value: ethers.parseEther("0.01") });

      // Resolve market
      await time.increase(2 * 24 * 60 * 60);
      await predictionMarket.connect(creator).resolveMarket(0, true);
    });

    it("Should allow emergency withdrawal after 30 days", async function () {
      // Fast forward 31 days after end time
      await time.increase(31 * 24 * 60 * 60);

      const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

      const tx = await predictionMarket.connect(creator).emergencyWithdraw(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

      // Creator should have received funds minus gas
      expect(creatorBalanceAfter).to.be.gt(creatorBalanceBefore - gasUsed);
    });

    it("Should fail emergency withdrawal before 30 days", async function () {
      await time.increase(20 * 24 * 60 * 60); // Only 20 days

      await expect(
        predictionMarket.connect(creator).emergencyWithdraw(0)
      ).to.be.revertedWith("Too early for emergency withdrawal");
    });

    it("Should fail if not creator", async function () {
      await time.increase(31 * 24 * 60 * 60);

      await expect(
        predictionMarket.connect(bettor1).emergencyWithdraw(0)
      ).to.be.revertedWith("Only creator can resolve");
    });

    it("Should fail if market not resolved", async function () {
      // Create new unresolved market
      await predictionMarket.connect(creator).createMarket("Unresolved", 1000);

      await time.increase(31 * 24 * 60 * 60);

      await expect(
        predictionMarket.connect(creator).emergencyWithdraw(1)
      ).to.be.revertedWith("Market must be resolved first");
    });
  });

  describe("Complex Scenarios", function () {
    it("Should handle multiple markets with different outcomes", async function () {
      // Create multiple markets
      await predictionMarket.connect(creator).createMarket("Market 1", 1000);
      await predictionMarket.connect(creator).createMarket("Market 2", 2000);

      // Place bets
      await predictionMarket
        .connect(bettor1)
        .placeBet(0, true, { value: ethers.parseEther("0.01") });
      await predictionMarket
        .connect(bettor1)
        .placeBet(1, false, { value: ethers.parseEther("0.02") });

      const totalMarkets = await predictionMarket.getTotalMarkets();
      expect(totalMarkets).to.equal(2);

      const bet0 = await predictionMarket.connect(bettor1).getBetExists(0);
      const bet1 = await predictionMarket.connect(bettor1).getBetExists(1);

      expect(bet0.exists).to.equal(true);
      expect(bet1.exists).to.equal(true);
    });

    it("Should track total markets correctly after multiple creations", async function () {
      for (let i = 0; i < 5; i++) {
        await predictionMarket.connect(creator).createMarket(`Market ${i}`, 1000 * (i + 1));
      }

      const totalMarkets = await predictionMarket.getTotalMarkets();
      expect(totalMarkets).to.equal(5);

      // Verify each market exists
      for (let i = 0; i < 5; i++) {
        const market = await predictionMarket.getMarket(i);
        expect(market.question).to.equal(`Market ${i}`);
      }
    });
  });
});
