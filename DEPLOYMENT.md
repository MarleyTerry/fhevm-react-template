# Deployment Guide

Complete guide for deploying and managing the Confidential Prediction Market smart contract.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Compilation](#compilation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Verification](#verification)
- [Contract Interaction](#contract-interaction)
- [Deployed Contracts](#deployed-contracts)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have the following installed:

- Node.js (v18 or higher)
- npm or yarn
- Git
- A wallet with testnet ETH (for Sepolia deployment)

## Environment Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Network RPC URLs
SEPOLIA_RPC_URL=https://rpc.sepolia.org
# Or use Alchemy/Infura:
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Private key of deployment account (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional: Enable gas reporting
REPORT_GAS=true
```

### 3. Fund Your Deployment Account

For Sepolia testnet deployment:

- Get your account address: The address corresponding to your private key
- Get testnet ETH from Sepolia faucet:
  - https://sepoliafaucet.com/
  - https://www.alchemy.com/faucets/ethereum-sepolia
  - https://faucet.quicknode.com/ethereum/sepolia

You'll need approximately 0.05 ETH for deployment and verification.

## Compilation

Compile the smart contracts:

```bash
npm run compile
```

This will:
- Compile all Solidity contracts in `contracts/`
- Generate artifacts in `artifacts/`
- Generate TypeChain typings (if configured)
- Display compilation warnings/errors

## Testing

### Run Full Test Suite

```bash
npm test
```

### Run Tests with Gas Reporting

```bash
REPORT_GAS=true npm test
```

### Run Tests with Coverage

```bash
npm run coverage
```

### Test Output

The test suite includes:
- Deployment tests
- Market creation tests
- Betting functionality tests
- Market resolution tests
- Emergency withdrawal tests
- Edge case scenarios

Expected output:
```
PredictionMarket
  ✓ Should deploy successfully
  ✓ Should create markets correctly
  ✓ Should handle bets properly
  ...
  X passing (Xms)
```

## Deployment

### Local Deployment (Hardhat Network)

Start a local Hardhat node:

```bash
npx hardhat node
```

In a new terminal, deploy:

```bash
npm run deploy:localhost
```

### Sepolia Testnet Deployment

Ensure your `.env` is configured correctly, then deploy:

```bash
npm run deploy:sepolia
```

Expected output:
```
========================================
Starting Confidential Prediction Market Deployment
========================================

Deploying contracts with account: 0x...
Account balance: 0.1 ETH
Network: sepolia (Chain ID: 11155111)

Deploying PredictionMarket contract...
✓ PredictionMarket deployed successfully!
Contract address: 0x...

✓ Deployment info saved to: deployments/sepolia.json
✓ Contract info saved for frontend: src/deployments/PredictionMarket.json
```

### Deployment Files

After deployment, you'll find:

- `deployments/sepolia.json` - Deployment information for backend use
- `src/deployments/PredictionMarket.json` - Contract info for frontend integration

These files contain:
- Contract address
- Network details
- Deployer address
- Deployment timestamp
- Block number

## Verification

Verify your contract on Etherscan after deployment:

```bash
npm run verify:sepolia
```

Or use the verification script directly:

```bash
node scripts/verify.js sepolia
```

Expected output:
```
========================================
Contract Verification Tool
========================================

Network: sepolia
Contract Address: 0x...
Deployer: 0x...

Verifying contract on Etherscan...
✓ Contract verified successfully!

View on Etherscan:
https://sepolia.etherscan.io/address/0x.../code
```

### Manual Verification

If automated verification fails, you can verify manually:

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

## Contract Interaction

### Using the Interaction Script

```bash
npm run interact:sepolia
```

Or directly:

```bash
node scripts/interact.js sepolia
```

This script allows you to:
- View all markets
- Check market details
- See betting information
- Get participant lists

### Example Interactions

#### Create a Market

```javascript
const question = "Will ETH reach $5000 by next month?";
const duration = 30 * 24 * 60 * 60; // 30 days in seconds
const tx = await predictionMarket.createMarket(question, duration);
await tx.wait();
```

#### Place a Bet

```javascript
const marketId = 0;
const prediction = true; // true for YES, false for NO
const betAmount = ethers.parseEther("0.01"); // 0.01 ETH
const tx = await predictionMarket.placeBet(marketId, prediction, {
  value: betAmount,
});
await tx.wait();
```

#### Resolve a Market (Creator Only)

```javascript
const marketId = 0;
const outcome = true; // true for YES, false for NO
const tx = await predictionMarket.resolveMarket(marketId, outcome);
await tx.wait();
```

#### Claim Winnings

```javascript
const marketId = 0;
const tx = await predictionMarket.claimWinnings(marketId);
await tx.wait();
```

### Using the Simulation Script

Run a full lifecycle simulation:

```bash
npm run simulate:sepolia
```

Or:

```bash
node scripts/simulate.js sepolia
```

This will:
1. Create multiple markets
2. Place bets from different accounts
3. Display market status
4. Simulate time progression (on local network)
5. Resolve markets
6. Demonstrate claiming process

## Deployed Contracts

### Sepolia Testnet

| Contract | Address | Explorer |
|----------|---------|----------|
| PredictionMarket | `TBD` | [View on Etherscan](https://sepolia.etherscan.io/address/TBD) |

**Network Details:**
- Network: Sepolia Testnet
- Chain ID: 11155111
- RPC URL: https://rpc.sepolia.org
- Explorer: https://sepolia.etherscan.io

**Contract Information:**
- Deployer: `TBD`
- Deployment Date: `TBD`
- Block Number: `TBD`
- Transaction Hash: `TBD`

**Key Parameters:**
- MIN_BET: 0.001 ETH
- MAX_BET: 10 ETH
- Emergency Withdrawal Period: 30 days after market end

## Hardhat Tasks

### Available Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to localhost
npm run deploy:localhost

# Deploy to Sepolia
npm run deploy:sepolia

# Verify on Sepolia
npm run verify:sepolia

# Interact with contract
npm run interact:sepolia

# Run simulation
npm run simulate:sepolia

# Clean artifacts
npm run clean

# Type check
npm run typecheck
```

### Custom Hardhat Tasks

You can also use Hardhat directly:

```bash
# Compile
npx hardhat compile

# Test
npx hardhat test

# Deploy
npx hardhat run scripts/deploy.js --network sepolia

# Verify
npx hardhat verify --network sepolia DEPLOYED_ADDRESS

# Clean
npx hardhat clean

# Get accounts
npx hardhat accounts

# Check balance
npx hardhat balance --account ADDRESS --network sepolia
```

## Troubleshooting

### Common Issues

#### 1. Insufficient Funds

**Error:** `insufficient funds for gas * price + value`

**Solution:**
- Ensure your deployment account has enough ETH
- Get more testnet ETH from faucets
- Check gas prices aren't unusually high

#### 2. Invalid Private Key

**Error:** `invalid private key`

**Solution:**
- Check that PRIVATE_KEY in .env is correct
- Remove any `0x` prefix from the private key
- Ensure there are no extra spaces or quotes

#### 3. Network Connection Issues

**Error:** `could not detect network`

**Solution:**
- Verify SEPOLIA_RPC_URL is correct
- Try alternative RPC endpoints (Alchemy, Infura)
- Check your internet connection

#### 4. Contract Already Verified

**Error:** `Already Verified`

**Solution:**
- This is actually success! Your contract is verified
- Check the Etherscan link to view the verified code

#### 5. Compilation Errors

**Error:** `Compilation failed`

**Solution:**
- Check Solidity version compatibility
- Ensure all dependencies are installed
- Run `npm install` again
- Clear cache with `npx hardhat clean`

#### 6. Nonce Too Low

**Error:** `nonce too low`

**Solution:**
- Reset your account nonce in MetaMask (Settings > Advanced > Reset Account)
- Or wait for pending transactions to complete

### Getting Help

If you encounter issues not covered here:

1. Check Hardhat documentation: https://hardhat.org/docs
2. Review ethers.js documentation: https://docs.ethers.org
3. Check contract events in Etherscan for transaction details
4. Verify your .env configuration
5. Ensure you're using compatible Node.js version (v18+)

## Security Considerations

### Before Mainnet Deployment

- [ ] Complete professional security audit
- [ ] Conduct thorough testing on testnet
- [ ] Review all contract functions for vulnerabilities
- [ ] Test emergency procedures
- [ ] Set up monitoring and alerts
- [ ] Prepare incident response plan
- [ ] Consider insurance coverage
- [ ] Implement multi-sig for critical functions
- [ ] Add timelock for administrative actions
- [ ] Document all assumptions and limitations

### Best Practices

1. **Never commit private keys** - Always use .env files
2. **Use hardware wallets** for mainnet deployments
3. **Test extensively** on testnets before mainnet
4. **Verify contracts** immediately after deployment
5. **Monitor contract activity** using block explorers
6. **Keep dependencies updated** but test thoroughly
7. **Document all changes** in version control
8. **Maintain deployment logs** for audit trails

## Next Steps

After successful deployment:

1. ✅ Verify contract on Etherscan
2. ✅ Test all functions using interaction script
3. ✅ Run simulation to ensure everything works
4. ✅ Update frontend with contract address
5. ✅ Document deployment in your records
6. ✅ Set up monitoring alerts
7. ✅ Prepare user documentation
8. ✅ Consider setting up a subgraph for event indexing

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org)
- [Sepolia Faucet](https://sepoliafaucet.com)
- [Etherscan Sepolia](https://sepolia.etherscan.io)
- [Solidity Documentation](https://docs.soliditylang.org)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)

---

**Last Updated:** 2025-10-30

For questions or support, please refer to the project README or open an issue in the repository.
