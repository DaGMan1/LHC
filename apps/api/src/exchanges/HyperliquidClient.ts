/**
 * Hyperliquid Client - Interface for Hyperliquid perpetuals DEX
 *
 * Hyperliquid is an on-chain perpetual futures exchange.
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/
 *
 * Note: Full trading requires wallet signature. This client provides
 * read-only market data access and structure for trading integration.
 */

import { createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains'; // Hyperliquid runs on Arbitrum

// ============================================
// TYPES
// ============================================

export interface HyperliquidMeta {
    universe: {
        name: string;
        szDecimals: number;
    }[];
}

export interface HyperliquidAssetCtx {
    funding: string;
    openInterest: string;
    prevDayPx: string;
    dayNtlVlm: string;
    premium: string;
    oraclePx: string;
    markPx: string;
    midPx: string;
    impactPxs: string[];
}

export interface PerpPosition {
    coin: string;
    szi: string; // Size (negative = short)
    leverage: number;
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    liquidationPx: string | null;
}

export interface PerpPrice {
    coin: string;
    markPrice: number;
    oraclePrice: number;
    fundingRate: number;
    openInterest: number;
    premium: number; // mark - oracle difference
}

// ============================================
// HYPERLIQUID CLIENT
// ============================================

export class HyperliquidClient {
    private baseUrl: string = 'https://api.hyperliquid.xyz';
    private infoUrl: string = 'https://api.hyperliquid.xyz/info';
    private exchangeUrl: string = 'https://api.hyperliquid.xyz/exchange';
    private account: ReturnType<typeof privateKeyToAccount> | null = null;
    private walletClient: ReturnType<typeof createWalletClient> | null = null;

    constructor() {
        // Initialize wallet if private key is available
        const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY || process.env.BOT_PRIVATE_KEY;
        if (privateKey) {
            try {
                this.account = privateKeyToAccount(privateKey as `0x${string}`);
                this.walletClient = createWalletClient({
                    account: this.account,
                    chain: arbitrum,
                    transport: http(),
                });
            } catch (error) {
                console.error('Failed to initialize Hyperliquid wallet:', error);
            }
        }
    }

    /**
     * Get all available perpetual markets
     */
    async getMarkets(): Promise<string[]> {
        try {
            const response = await fetch(this.infoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'meta' }),
            });
            const data: HyperliquidMeta = await response.json();
            return data.universe.map((u) => u.name);
        } catch (error) {
            console.error('Hyperliquid markets fetch error:', error);
            return [];
        }
    }

    /**
     * Get perpetual price for a specific coin
     */
    async getPerpPrice(coin: string): Promise<PerpPrice | null> {
        try {
            const response = await fetch(this.infoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
            });
            const data = await response.json();

            // Find the coin in the response
            const meta = data[0] as HyperliquidMeta;
            const assetCtxs = data[1] as HyperliquidAssetCtx[];

            const coinIndex = meta.universe.findIndex((u) => u.name === coin);
            if (coinIndex === -1) return null;

            const ctx = assetCtxs[coinIndex];
            if (!ctx) return null;

            const markPrice = parseFloat(ctx.markPx);
            const oraclePrice = parseFloat(ctx.oraclePx);

            return {
                coin,
                markPrice,
                oraclePrice,
                fundingRate: parseFloat(ctx.funding),
                openInterest: parseFloat(ctx.openInterest),
                premium: ((markPrice - oraclePrice) / oraclePrice) * 100,
            };
        } catch (error) {
            console.error(`Hyperliquid price fetch error for ${coin}:`, error);
            return null;
        }
    }

    /**
     * Get ETH perpetual price (convenience method)
     */
    async getEthPerpPrice(): Promise<PerpPrice | null> {
        return this.getPerpPrice('ETH');
    }

    /**
     * Get multiple perp prices
     */
    async getMultiplePerpPrices(coins: string[]): Promise<Map<string, PerpPrice>> {
        const results = new Map<string, PerpPrice>();

        try {
            const response = await fetch(this.infoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
            });
            const data = await response.json();

            const meta = data[0] as HyperliquidMeta;
            const assetCtxs = data[1] as HyperliquidAssetCtx[];

            for (const coin of coins) {
                const coinIndex = meta.universe.findIndex((u) => u.name === coin);
                if (coinIndex === -1) continue;

                const ctx = assetCtxs[coinIndex];
                if (!ctx) continue;

                const markPrice = parseFloat(ctx.markPx);
                const oraclePrice = parseFloat(ctx.oraclePx);

                results.set(coin, {
                    coin,
                    markPrice,
                    oraclePrice,
                    fundingRate: parseFloat(ctx.funding),
                    openInterest: parseFloat(ctx.openInterest),
                    premium: ((markPrice - oraclePrice) / oraclePrice) * 100,
                });
            }
        } catch (error) {
            console.error('Hyperliquid multi-price fetch error:', error);
        }

        return results;
    }

    /**
     * Calculate funding rate arbitrage opportunity
     * Positive funding = longs pay shorts (good to short perp, long spot)
     * Negative funding = shorts pay longs (good to long perp, short spot)
     */
    async getFundingArbOpportunity(coin: string): Promise<{
        exists: boolean;
        direction: 'long' | 'short' | null;
        fundingRate: number;
        annualizedYield: number;
        premium: number;
    }> {
        const perpPrice = await this.getPerpPrice(coin);

        if (!perpPrice) {
            return {
                exists: false,
                direction: null,
                fundingRate: 0,
                annualizedYield: 0,
                premium: 0,
            };
        }

        // Funding is paid every 8 hours, so annualize it
        // Daily = funding * 3, Annual = funding * 3 * 365
        const annualizedYield = Math.abs(perpPrice.fundingRate) * 3 * 365 * 100;

        // Opportunity exists if funding > 0.01% (10 bps) per 8 hours
        // That's ~10.95% annualized
        const exists = Math.abs(perpPrice.fundingRate) > 0.0001;

        return {
            exists,
            direction: perpPrice.fundingRate > 0 ? 'short' : 'long',
            fundingRate: perpPrice.fundingRate,
            annualizedYield,
            premium: perpPrice.premium,
        };
    }

    // ============================================
    // TRADING (Requires wallet signature)
    // ============================================

    /**
     * Place a perpetual order
     */
    async placeOrder(params: {
        coin: string;
        isBuy: boolean;
        sz: number;
        limitPx: number;
        reduceOnly?: boolean;
    }): Promise<{ success: boolean; orderId?: string; error?: string }> {
        if (!this.account || !this.walletClient) {
            return {
                success: false,
                error: 'Wallet not initialized - set HYPERLIQUID_PRIVATE_KEY or BOT_PRIVATE_KEY',
            };
        }

        try {
            // Build order action
            const order = {
                a: 2, // Asset index (2 = ETH for most cases, should be looked up from meta)
                b: params.isBuy,
                p: params.limitPx.toString(),
                s: params.sz.toString(),
                r: params.reduceOnly || false,
                t: { limit: { tif: 'Gtc' } }, // Good-til-cancel
            };

            // Get current timestamp
            const timestamp = Date.now();

            // Create EIP-712 signature
            const action = {
                type: 'order',
                orders: [order],
                grouping: 'na',
            };

            // Sign the action (Hyperliquid requires specific EIP-712 format)
            // This is a simplified version - production needs exact Hyperliquid domain/types
            const signature = await this.walletClient.signTypedData({
                account: this.account,
                domain: {
                    name: 'Exchange',
                    version: '1',
                    chainId: 42161, // Arbitrum
                    verifyingContract: '0x0000000000000000000000000000000000000000' as Address,
                },
                types: {
                    Agent: [
                        { name: 'source', type: 'string' },
                        { name: 'connectionId', type: 'bytes32' },
                    ],
                },
                primaryType: 'Agent',
                message: {
                    source: 'a',
                    connectionId: `0x${'0'.repeat(64)}`,
                },
            });

            // Send order to exchange
            const response = await fetch(this.exchangeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    nonce: timestamp,
                    signature,
                    vaultAddress: null,
                }),
            });

            const result = await response.json();

            if (result.status === 'ok') {
                return {
                    success: true,
                    orderId: result.response?.data?.statuses?.[0]?.resting?.oid,
                };
            } else {
                return {
                    success: false,
                    error: result.response || 'Order placement failed',
                };
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Hyperliquid order placement error:', errorMsg);
            return {
                success: false,
                error: errorMsg,
            };
        }
    }

    /**
     * Place a market order (use aggressive limit price)
     */
    async placeMarketOrder(params: {
        coin: string;
        isBuy: boolean;
        sz: number;
    }): Promise<{ success: boolean; orderId?: string; error?: string }> {
        // Get current market price
        const perpPrice = await this.getPerpPrice(params.coin);
        if (!perpPrice) {
            return { success: false, error: 'Could not fetch market price' };
        }

        // Use aggressive limit price (1% slippage)
        const slippage = params.isBuy ? 1.01 : 0.99;
        const limitPx = perpPrice.markPrice * slippage;

        return this.placeOrder({
            ...params,
            limitPx,
        });
    }

    /**
     * Close an existing position
     */
    async closePosition(coin: string): Promise<{ success: boolean; error?: string }> {
        if (!this.account) {
            return { success: false, error: 'Wallet not initialized' };
        }

        try {
            // Get current position
            const position = await this.getPosition(coin);
            if (!position) {
                return { success: false, error: 'No position found' };
            }

            const szi = parseFloat(position.szi);
            if (szi === 0) {
                return { success: false, error: 'Position size is zero' };
            }

            // Close position (opposite direction, reduce-only)
            const isBuy = szi < 0; // If short, need to buy to close
            const sz = Math.abs(szi);

            return this.placeMarketOrder({
                coin,
                isBuy,
                sz,
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMsg };
        }
    }

    /**
     * Get user's position for a specific coin
     */
    async getPosition(coin: string): Promise<PerpPosition | null> {
        if (!this.account) {
            console.warn('Cannot get position - wallet not initialized');
            return null;
        }

        try {
            const response = await fetch(this.infoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'clearinghouseState',
                    user: this.account.address,
                }),
            });
            const data = await response.json();

            // Find position for this coin
            const positions = data.assetPositions || [];
            const position = positions.find((p: PerpPosition) => p.coin === coin);

            return position || null;
        } catch (error) {
            console.error(`Hyperliquid position fetch error for ${coin}:`, error);
            return null;
        }
    }

    /**
     * Get all user positions
     */
    async getAllPositions(): Promise<PerpPosition[]> {
        if (!this.account) {
            console.warn('Cannot get positions - wallet not initialized');
            return [];
        }

        try {
            const response = await fetch(this.infoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'clearinghouseState',
                    user: this.account.address,
                }),
            });
            const data = await response.json();

            return data.assetPositions || [];
        } catch (error) {
            console.error('Hyperliquid all positions fetch error:', error);
            return [];
        }
    }
}

// Singleton export
export const hyperliquidClient = new HyperliquidClient();
