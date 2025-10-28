# Confidential Prediction Market Example

A real-world example of a confidential prediction market built with FHEVM SDK. Users can place encrypted bets on prediction markets, keeping their predictions private until market resolution.

## Features

- ✅ Create prediction markets
- ✅ Place encrypted bets (predictions remain confidential)
- ✅ Resolve markets (only creator)
- ✅ Claim winnings
- ✅ Full FHEVM encryption for privacy
- ✅ Integration with FHEVM SDK

## Smart Contract

The `PredictionMarket.sol` contract uses FHEVM for:
- Encrypted bet amounts (`euint32`)
- Encrypted predictions (`ebool`)
- Private betting until resolution
- Secure payout calculations

## Getting Started

### Install Dependencies

```bash
npm install
```

### Compile Contracts

```bash
npm run compile
```

### Deploy Contract

For local network:
```bash
npm run deploy
```

For Sepolia testnet:
```bash
npm run deploy:sepolia
```

### Run Frontend

```bash
npm run dev
```

## Usage Flow

1. **Connect Wallet**: Connect MetaMask to Sepolia or FHEVM network
2. **View Markets**: See active prediction markets
3. **Place Bet**:
   - Select YES or NO prediction
   - Enter bet amount (0.001 - 10 ETH)
   - Bet is encrypted with FHEVM
4. **Wait for Resolution**: Market creator resolves when time expires
5. **Claim Winnings**: If you predicted correctly, claim your share

## Technical Details

### Encryption

The app uses FHEVM SDK to encrypt:
- Bet predictions (true/false)
- Bet amounts
- User data

### Contract Integration

```typescript
import { useEncryptedTransaction } from '@fhevm/sdk/react';

const { sendEncryptedTransaction } = useEncryptedTransaction({
  address: contractAddress,
  abi: PREDICTION_MARKET_ABI,
  signer
});

// Place encrypted bet
await sendEncryptedTransaction({
  method: 'placeBet',
  encryptedInputs: [
    { type: 'uint32', value: betAmount },
    { type: 'bool', value: prediction }
  ],
  additionalArgs: [marketId]
});
```

## Project Structure

```
prediction-market/
├── contracts/
│   └── PredictionMarket.sol    # Main contract
├── src/
│   ├── components/
│   │   ├── CreateMarket.tsx
│   │   ├── MarketCard.tsx
│   │   └── MarketList.tsx
│   ├── App.tsx
│   └── types/
├── scripts/
│   └── deploy.js
└── hardhat.config.js
```

## Contract Events

- `MarketCreated`: New market is created
- `BetPlaced`: User places an encrypted bet
- `MarketResolved`: Market outcome is determined
- `WinningsClaimed`: Winner claims their payout

## Security Features

- ✅ Encrypted predictions prevent front-running
- ✅ Only market creator can resolve
- ✅ Bet amounts validated on-chain
- ✅ Reentrancy protection
- ✅ Time-locked market resolution

## Testing

Run contract tests:

```bash
npm test
```

## Learn More

- [FHEVM SDK Documentation](../../README.md)
- [Zama FHEVM](https://docs.zama.ai/fhevm)
- [Prediction Markets](https://en.wikipedia.org/wiki/Prediction_market)

## License

MIT
