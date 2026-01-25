/**
 * Hyperliquid Client - Interface for Hyperliquid perpetuals DEX
 *
 * Hyperliquid is an on-chain perpetual futures exchange.
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/
 *
 * Note: Full trading requires wallet signature. This client provides
 * read-only market data access and structure for trading integration.
 */

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
    // TRADING (Requires wallet signature - placeholder)
    // ============================================

    /**
     * Place a perpetual order
     * NOTE: This requires wallet signature implementation
     * For now, this is a placeholder showing the structure
     */
    async placeOrder(params: {
        coin: string;
        isBuy: boolean;
        sz: number;
        limitPx: number;
        reduceOnly?: boolean;
    }): Promise<{ success: boolean; error?: string }> {
        // TODO: Implement wallet signature and order placement
        // This requires:
        // 1. HYPERLIQUID_PRIVATE_KEY from env
        // 2. Signing the order with the wallet
        // 3. Posting to /exchange endpoint

        console.warn('Hyperliquid trading not yet implemented');
        return {
            success: false,
            error: 'Trading not implemented - read-only mode',
        };
    }
}

// Singleton export
export const hyperliquidClient = new HyperliquidClient();
