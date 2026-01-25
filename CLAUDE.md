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

## Current Status (MVP)

- **Bots:** Dry-run mode with simulated signals
- **Intel:** Mock market data (future: real Aerodrome/Uniswap polling)
- **Contracts:** FlashArb.sol ready but not deployed to mainnet
- **Deployment:** Docker + Cloud Run pipeline configured

---

## Key File Locations

| Purpose | Path |
|---------|------|
| API entry | `apps/api/src/index.ts` |
| Bot base class | `apps/api/src/bots/BaseStrategy.ts` |
| Flash loan bot | `apps/api/src/bots/FlashLoanArb.ts` |
| Intel engine | `apps/api/src/intel.ts` |
| Web page | `apps/web/src/app/page.tsx` |
| Intel context | `apps/web/src/components/IntelProvider.tsx` |
| Strategy card | `apps/web/src/components/StrategyCard.tsx` |
| Wagmi config | `apps/web/src/config/wagmi.ts` |
| FlashArb contract | `contracts/contracts/FlashArb.sol` |
| Hardhat config | `contracts/hardhat.config.ts` |
