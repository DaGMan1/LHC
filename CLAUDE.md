# LHC-1 Codebase Context

## Overview

**LHC-1 (Large Hadron Collider)** is a decentralized algorithmic trading platform built as a Turbo monorepo. It provides automated trading strategies (bots) for DeFi protocols on Base network, with a real-time web dashboard for monitoring and control.

## Project Structure

```
LHC-1/
├── apps/
│   ├── api/           # Express.js backend (port 3001)
│   └── web/           # Next.js 16 frontend (port 3000)
├── contracts/         # Solidity smart contracts (Hardhat)
├── packages/
│   ├── tsconfig/      # Shared TypeScript configs
│   └── shared/        # Reserved for shared utilities
├── turbo.json         # Monorepo task orchestration
├── deploy.sh          # Cloud Run deployment script
├── cloudbuild-*.yaml  # Google Cloud Build configs
└── Dockerfiles        # Multi-stage container builds
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16.1.3, React 19.2.3, Tailwind CSS v4 |
| Web3 | Wagmi 3.3.2, Viem 2.44.4, TanStack React Query |
| Backend | Express.js 4.18.2, TypeScript 5.1.6 |
| Blockchain | Base Network (L2), Solidity 0.8.27 |
| Contracts | Hardhat, Aave V3 (flash loans), Uniswap V3 |
| DevOps | Docker, Google Cloud Run, Turbo |

---

## Backend API (apps/api)

### Entry Point: `apps/api/src/index.ts`

**Endpoints:**
- `GET /api/intel` - SSE stream for real-time market intel and bot status
- `GET /api/bots` - Returns all bot states
- `POST /api/bots/:id/start` - Start a specific bot
- `POST /api/bots/:id/stop` - Stop a specific bot
- `GET /health` - Health check

### Bot Architecture

**Base Class:** `apps/api/src/bots/BaseStrategy.ts`
- Abstract class for all trading strategies
- Manages lifecycle: start(), stop(), run()
- 10-second execution interval
- Event emitter for real-time logging
- Dry-run mode by default (no actual trades)

**Implemented Strategies:**

| Bot | File | Capital | Strategy |
|-----|------|---------|----------|
| FlashLoanArb | `apps/api/src/bots/FlashLoanArb.ts` | $2,500 | Arbitrage between Aerodrome/Uniswap V3 |
| CexPerpDelta | `apps/api/src/bots/CexPerpDelta.ts` | $5,000 | CEX spot vs Hyperliquid perp arb |
| GridBot | `apps/api/src/bots/GridBot.ts` | $1,500 | Dynamic grid trading WETH-USDC |

**Manager:** `apps/api/src/bots/BotManager.ts` - Singleton registry for all bots

### Supporting Modules

- `apps/api/src/intel.ts` - Market intel engine (event emitter, generates signals every 5s)
- `apps/api/src/viemClient.ts` - Viem public client for Base network
- `apps/api/src/liquidity.ts` - Pool depth monitoring via Uniswap V3

---

## Frontend Web App (apps/web)

### App Structure

- `apps/web/src/app/layout.tsx` - Root layout with provider hierarchy
- `apps/web/src/app/page.tsx` - Main dashboard (single-page terminal UI)
- `apps/web/src/app/globals.css` - Tailwind v4 theme (dark mode)

### Components

| Component | Purpose |
|-----------|---------|
| `Providers.tsx` | Wagmi, React Query, Intel context setup |
| `IntelProvider.tsx` | Central SSE stream management, bot state context |
| `TopNav.tsx` | Navigation, wallet connection (MetaMask priority) |
| `StrategyCard.tsx` | Individual bot display with start/stop controls |
| `ActivityFeed.tsx` | Live intel message log (50 messages) |
| `BotInterface.tsx` | AI assistant panel with aggregate stats |
| `MarketSignal.tsx` | High-priority alert banner |

### State Management

```
Wagmi Provider (Web3)
  └── QueryClientProvider (React Query)
       └── IntelProvider (Custom Context)
            ├── Intel messages via SSE
            └── Bot states updated in real-time
```

### Wagmi Config: `apps/web/src/config/wagmi.ts`

**Supported Networks:** Base, Ethereum Mainnet, Hardhat (localhost)
**Connectors:** Injected, MetaMask, Coinbase Wallet

---

## Smart Contracts (contracts/)

### FlashArb.sol: `contracts/contracts/FlashArb.sol`

**Purpose:** Atomic flash loan arbitrage

**Key Features:**
- Implements `IFlashLoanSimpleReceiver` (Aave V3)
- Borrows capital via `POOL.flashLoanSimple()`
- Executes 2-leg swap: Asset → tokenOut → Asset (Uniswap V3)
- Validates profit > premium before repayment
- Owner-gated withdrawal for profit recovery

**Integrations:**
- Aave V3 - Flash loans (0.05% premium)
- Uniswap V3 - SwapRouter for token swaps
- OpenZeppelin - SafeERC20 for secure transfers

### Hardhat Config: `contracts/hardhat.config.ts`

- Solidity 0.8.27
- Default network: hardhat (chainId 31337)
- Tenderly integration for verification

---

## Data Flow

```
┌─────────────────────────────────────┐
│  Bot Strategies (10s interval)      │
│  FlashLoanArb, CexPerpDelta, Grid   │
└──────────────┬──────────────────────┘
               │ emit('intel')
               ▼
┌─────────────────────────────────────┐
│  Market Intel Engine                │
│  Generates signals, aggregates logs │
└──────────────┬──────────────────────┘
               │ SSE stream
               ▼
┌─────────────────────────────────────┐
│  IntelProvider (React Context)      │
│  messages[], botStates[], priority  │
└──────────────┬──────────────────────┘
               │ useIntelContext()
               ▼
┌─────────────────────────────────────┐
│  UI Components                      │
│  StrategyCard, ActivityFeed, etc.   │
└─────────────────────────────────────┘
```

---

## Development Commands

```bash
# Start all dev servers (web:3000, api:3001)
npm run dev

# Build all packages
npm run build

# Run tests
npm run test

# Lint codebase
npm run lint

# Clean build artifacts
npm run clean
```

---

## Environment Variables

```env
# API
PORT=3001
BASE_RPC_URL=https://mainnet.base.org

# Contracts (Tenderly)
TENDERLY_PROJECT=...
TENDERLY_USERNAME=...
TENDERLY_ACCESS_KEY=...
```

---

## Design System (Web)

**Color Palette:**
- Background: `#020408` (near black)
- Card: `#0c0f16` (dark slate)
- Primary: `#6366f1` (indigo)
- Accent: `#10b981` (emerald)
- Border: `#1e293b` (slate)

**Typography:** Geist Sans / Geist Mono

---

## Current Status (Jan 29, 2026)

- **Flash Loan Arb:** LIVE mode, scanning blocks, blocked by pool depth bug
- **Contract:** Deployed at `0x8df331d5f493fe065692f97a349cfe8c6941bcea`
- **Bot Wallet:** Funded at `0x273fdD310c80e95B92eA60Bf12A4391Ca2C3f640`
- **Intel:** Real-time SSE stream showing 6-20 bps spreads
- **Issue:** ArbitrageScanner.ts:119 blocking execution (pool depth unavailable)
- **Deployment:** Live on Google Cloud Run (project: `lhc-terminal-alpha-1768620729`)
- **Action Needed:** Fix pool depth check, lower MIN_PROFIT_USD to $2-3

---

## Cloud Run Deployment

**Production URLs:**
- Web: https://lhc-web-29418249188.us-central1.run.app
- API: https://lhc-api-cky7mlzabq-uc.a.run.app

**Deploy Command:**
```bash
./deploy.sh lhc-terminal-alpha-1768620729
```

**Bot Wallet (Executor):** `0x273fdD310c80e95B92eA60Bf12A4391Ca2C3f640`
- Can trigger trades but CANNOT withdraw
- Private key stored in Secret Manager as `lhc-bot-private-key`
- Funded with ~$50 Base ETH for gas

**Deployed FlashArb Contract:** `0x8df331d5f493fe065692f97a349cfe8c6941bcea`
- Owner: User's MetaMask wallet
- Authorized executor: Bot wallet
- Status: Active and ready for autonomous trading

---

## Contract Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| Aave PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |
| Uniswap V3 SwapRouter | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| WETH | `0x4200000000000000000000000000000000000006` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

---

## Key Web Components

| Component | Purpose |
|-----------|---------|
| `ActivationPanel.tsx` | One-click bot activation (deploy → authorize → go live) |
| `useFlashArb.ts` | Hook for contract deployment and interaction |
| `FlashArbBytecode.json` | Compiled ABI + bytecode for client-side deployment |

---

## Key File Locations

| Purpose | Path |
|---------|------|
| **BUG LOCATION** | `apps/api/src/services/ArbitrageScanner.ts:119` |
| API entry | `apps/api/src/index.ts` |
| Bot base class | `apps/api/src/bots/BaseStrategy.ts` |
| Flash loan bot | `apps/api/src/bots/FlashLoanArb.ts` |
| Arbitrage scanner | `apps/api/src/services/ArbitrageScanner.ts` |
| Pool depth monitor | `apps/api/src/liquidity.ts` |
| Price oracle | `apps/api/src/oracles/PriceOracle.ts` |
| Runtime config | `apps/api/src/config/runtimeConfig.ts` |
| Contract client | `apps/api/src/contracts/FlashArbClient.ts` |
| Intel engine | `apps/api/src/intel.ts` |
| Web page | `apps/web/src/app/page.tsx` |
| Activation UI | `apps/web/src/components/ActivationPanel.tsx` |
| FlashArb hook | `apps/web/src/hooks/useFlashArb.ts` |
| Contract ABI/bytecode | `apps/web/src/contracts/FlashArbBytecode.json` |
| Base addresses | `apps/web/src/contracts/FlashArbABI.ts` |
| Intel context | `apps/web/src/components/IntelProvider.tsx` |
| Wagmi config | `apps/web/src/config/wagmi.ts` |
| FlashArb contract | `contracts/contracts/FlashArb.sol` |
| Deploy script | `deploy.sh` |
| Current status | `claude.task` |
