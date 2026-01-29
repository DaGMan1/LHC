# LHC-1 (Large Hadron Collider)

Decentralized algorithmic trading platform for DeFi protocols on Base L2.

## Overview

LHC-1 is a modular trading bot system that monitors blockchain markets and executes various trading strategies. The platform features:

- **One-click activation** - Deploy contracts and start trading with a single button
- **Browser-based security** - All trades execute via MetaMask, never exposing private keys
- **Real-time monitoring** - Live intel feed and market signals via SSE
- **Multiple strategies** - Flash loan arbitrage, CEX-perp delta, and grid trading

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Web Dashboard (Next.js)                                     │
│  - Connect MetaMask wallet                                   │
│  - One-click activation (deploy + authorize + go live)       │
│  - Real-time intel feed                                      │
│  - Strategy monitoring and control                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ SSE stream
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  API Server (Express.js)                                     │
│  - Scans blockchain for opportunities                        │
│  - Manages bot lifecycle (start/stop)                        │
│  - Streams market intel to dashboard                         │
│  - Executes trades via bot wallet (when authorized)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Smart Contracts (Solidity)                                  │
│  - FlashArb.sol: Aave flash loan + Uniswap V3 swaps          │
│  - Owner/Executor security model                             │
│  - Profit accumulation and withdrawal                        │
└─────────────────────────────────────────────────────────────┘
```

## Trading Strategies

### 1. Flash Loan Arbitrage (Live)

**Status:** Fully implemented with live trading capability

Flash loan arbitrage exploits price differences between DEX pools without requiring upfront capital:

1. Borrow WETH via Aave V3 flash loan (0.05% fee)
2. Swap WETH → USDC on lower-priced pool
3. Swap USDC → WETH on higher-priced pool
4. Repay flash loan + fee
5. Keep profit

**How it works:**
- Scanner monitors WETH/USDC pools at different fee tiers (0.05%, 0.30%, 1.00%)
- When spread exceeds fees + minimum profit threshold, opportunity is detected
- Bot wallet executes the flash loan transaction atomically
- If trade would be unprofitable, transaction reverts (no loss except gas)

**Key parameters:**
- Minimum profit: $5 (configurable via `MIN_PROFIT_USD`)
- Maximum flash loan: $10,000 (configurable via `MAX_FLASH_LOAN_USD`)
- Gas price limit: 0.1 gwei (configurable via `MAX_GAS_PRICE_GWEI`)

### 2. CEX-Perp Delta (Simulation Only)

**Status:** Monitoring and signal generation implemented; live trading NOT implemented

This strategy exploits divergence between centralized exchange spot prices and perpetual futures:

1. Monitor ETH spot price from CEX aggregated feeds
2. Monitor ETH perpetual price on Hyperliquid
3. When divergence exceeds 0.5%:
   - If perp > spot: Short perp, long spot
   - If perp < spot: Long perp, short spot
4. Close when prices converge

**Why simulation only:**
- Requires Hyperliquid SDK integration for order placement
- Needs position management and margin handling
- Cross-venue execution adds complexity

### 3. Dynamic Grid Bot (Simulation Only)

**Status:** Grid logic implemented; live trading NOT implemented

Grid trading profits from price oscillations within a defined range:

1. Define price range (e.g., $2800 - $3200 for ETH)
2. Place buy orders at grid levels below current price
3. Place sell orders at grid levels above current price
4. When price crosses a level, execute and place opposite order
5. Profit = grid spacing on each round trip

**Why simulation only:**
- Requires limit order functionality (DEX aggregator or LP position management)
- Capital needs to be locked in grid positions
- More complex risk management needed

## Security Model

The system uses a two-wallet security model:

**Owner Wallet (Your MetaMask):**
- Deploys the FlashArb contract
- Authorizes executor addresses
- Withdraws profits
- Can pause/unpause contract

**Executor Wallet (Bot):**
- Can trigger flash loan trades
- CANNOT withdraw funds
- CANNOT change contract settings

This ensures your funds are safe even if the bot wallet is compromised - the attacker could only execute trades (which revert if unprofitable), never steal accumulated profits.

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask wallet with Base network configured
- ~$50 ETH on Base for gas and deployment

### Installation

```bash
# Clone repository
git clone <repo-url>
cd LHC-1

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your settings
```

### Environment Variables

```env
# API Server
PORT=3001
BASE_RPC_URL=https://mainnet.base.org

# Bot Wallet (for autonomous trading)
BOT_PRIVATE_KEY=your_bot_wallet_private_key

# Trading Parameters
DRY_RUN=false
MIN_PROFIT_USD=5
MAX_GAS_PRICE_GWEI=0.1
MAX_FLASH_LOAN_USD=10000
```

### Running Locally

```bash
# Start both API and Web in development mode
npm run dev

# Or start individually
npm run dev --workspace=apps/api
npm run dev --workspace=apps/web
```

Open http://localhost:3000 in your browser.

### Activation Flow

1. **Connect Wallet** - Click connect and select MetaMask
2. **Click "Activate Trading Bot"** - This will:
   - Deploy FlashArb contract (first time only, ~$2-5 gas)
   - Authorize bot wallet as executor (~$0.50 gas)
   - Sync contract address to API
   - Enable live trading mode
3. **Monitor** - Watch the Activity Feed for opportunities and executions

## Deployment

### Google Cloud Run

The project includes deployment configurations for Google Cloud Run:

```bash
# Build and deploy
./deploy.sh

# Or use Cloud Build directly
gcloud builds submit --config cloudbuild-api.yaml
gcloud builds submit --config cloudbuild-web.yaml
```

**Environment variables for production:**
- Store `BOT_PRIVATE_KEY` in Google Secret Manager
- Set `NEXT_PUBLIC_API_URL` to your API's Cloud Run URL

## Project Structure

```
LHC-1/
├── apps/
│   ├── api/                    # Express.js backend
│   │   └── src/
│   │       ├── bots/           # Trading strategies
│   │       │   ├── BaseStrategy.ts
│   │       │   ├── FlashLoanArb.ts
│   │       │   ├── CexPerpDelta.ts
│   │       │   └── GridBot.ts
│   │       ├── services/       # Business logic
│   │       │   ├── ArbitrageScanner.ts
│   │       │   └── GridManager.ts
│   │       ├── oracles/        # Price feeds
│   │       └── exchanges/      # CEX integrations
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── components/     # React components
│           ├── hooks/          # Custom hooks (useFlashArb)
│           └── contracts/      # ABI and bytecode
├── contracts/                  # Solidity smart contracts
│   └── contracts/
│       └── FlashArb.sol
└── packages/
    └── tsconfig/              # Shared TypeScript configs
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intel` | GET (SSE) | Real-time market intel stream |
| `/api/bots` | GET | List all bot states |
| `/api/bots/:id/start` | POST | Start a specific bot |
| `/api/bots/:id/stop` | POST | Stop a specific bot |
| `/api/config` | GET | Get current configuration |
| `/api/config/contract` | POST | Set contract address |
| `/api/go-live` | POST | Enable live trading mode |
| `/health` | GET | Health check |

## Smart Contract

### FlashArb.sol

The core arbitrage contract deployed on Base:

**Key functions:**
- `requestFlashLoan(token, amount, params)` - Execute flash loan arbitrage
- `setExecutor(address, allowed)` - Add/remove authorized executors
- `withdraw(token)` - Withdraw accumulated profits (owner only)
- `setPaused(bool)` - Emergency pause/unpause

**Events:**
- `ArbitrageExecuted(asset, flashAmount, profit, timestamp)`
- `ExecutorUpdated(executor, allowed)`
- `Withdrawal(token, amount)`

## Known Limitations

1. **CEX-Perp and Grid bots are simulation only** - Live trading requires additional integrations
2. **Single chain** - Currently only supports Base L2
3. **WETH/USDC only** - Flash loan arb only monitors WETH/USDC pools
4. **No auto-compounding** - Profits must be manually withdrawn

## Troubleshooting

**MetaMask cancels transaction:**
- Clear browser cache and localStorage
- Ensure you're on Base network (chainId: 8453)
- Check that contract ABI matches deployed bytecode

**SSE connection drops:**
- The IntelProvider auto-reconnects after 3 seconds
- Check API server is running and accessible

**Bot wallet not configured:**
- Ensure `BOT_PRIVATE_KEY` is set in `.env` or Cloud Secret Manager
- Key must be 64 hex characters (with or without 0x prefix)

## License

MIT

## Disclaimer

This software is for educational purposes. Trading cryptocurrencies involves significant risk. Never trade with funds you cannot afford to lose. Always test with small amounts first.
