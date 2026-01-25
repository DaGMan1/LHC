/**
 * CEX Price Feeds - Fetches spot prices from centralized exchanges
 * Uses public REST APIs (no authentication needed)
 */

// ============================================
// TYPES
// ============================================

export interface SpotPrice {
    exchange: string;
    symbol: string;
    price: number;
    timestamp: number;
}

export interface PriceComparison {
    symbol: string;
    prices: SpotPrice[];
    avgPrice: number;
    spread: number;
    spreadPercent: number;
}

// ============================================
// PRICE FEEDS
// ============================================

export class CexPriceFeeds {
    private cache: Map<string, { price: SpotPrice; expiry: number }> = new Map();
    private cacheTTL: number = 5000; // 5 seconds

    /**
     * Get ETH/USD price from Coinbase
     */
    async getCoinbasePrice(symbol: string = 'ETH-USD'): Promise<SpotPrice | null> {
        const cacheKey = `coinbase-${symbol}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(
                `https://api.coinbase.com/v2/prices/${symbol}/spot`
            );
            const data = await response.json();

            if (data.data?.amount) {
                const price: SpotPrice = {
                    exchange: 'Coinbase',
                    symbol,
                    price: parseFloat(data.data.amount),
                    timestamp: Date.now(),
                };
                this.setCache(cacheKey, price);
                return price;
            }
            return null;
        } catch (error) {
            console.error('Coinbase price fetch error:', error);
            return null;
        }
    }

    /**
     * Get ETH/USDT price from Binance
     */
    async getBinancePrice(symbol: string = 'ETHUSDT'): Promise<SpotPrice | null> {
        const cacheKey = `binance-${symbol}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(
                `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
            );
            const data = await response.json();

            if (data.price) {
                const price: SpotPrice = {
                    exchange: 'Binance',
                    symbol,
                    price: parseFloat(data.price),
                    timestamp: Date.now(),
                };
                this.setCache(cacheKey, price);
                return price;
            }
            return null;
        } catch (error) {
            console.error('Binance price fetch error:', error);
            return null;
        }
    }

    /**
     * Get ETH/USD price from Kraken
     */
    async getKrakenPrice(pair: string = 'XETHZUSD'): Promise<SpotPrice | null> {
        const cacheKey = `kraken-${pair}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(
                `https://api.kraken.com/0/public/Ticker?pair=${pair}`
            );
            const data = await response.json();

            if (data.result?.[pair]) {
                const ticker = data.result[pair];
                const price: SpotPrice = {
                    exchange: 'Kraken',
                    symbol: pair,
                    price: parseFloat(ticker.c[0]), // Last trade price
                    timestamp: Date.now(),
                };
                this.setCache(cacheKey, price);
                return price;
            }
            return null;
        } catch (error) {
            console.error('Kraken price fetch error:', error);
            return null;
        }
    }

    /**
     * Get prices from all exchanges and compare
     */
    async getAggregatedPrice(asset: string = 'ETH'): Promise<PriceComparison | null> {
        const [coinbase, binance, kraken] = await Promise.all([
            this.getCoinbasePrice(`${asset}-USD`),
            this.getBinancePrice(`${asset}USDT`),
            this.getKrakenPrice(`X${asset}ZUSD`),
        ]);

        const prices = [coinbase, binance, kraken].filter(
            (p): p is SpotPrice => p !== null
        );

        if (prices.length < 2) {
            return null;
        }

        const priceValues = prices.map((p) => p.price);
        const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const spread = maxPrice - minPrice;
        const spreadPercent = (spread / avgPrice) * 100;

        return {
            symbol: asset,
            prices,
            avgPrice,
            spread,
            spreadPercent,
        };
    }

    /**
     * Get best bid/ask across exchanges (for arb detection)
     */
    async getBestPrices(asset: string = 'ETH'): Promise<{
        bestBid: SpotPrice | null;
        bestAsk: SpotPrice | null;
        spread: number;
    }> {
        const comparison = await this.getAggregatedPrice(asset);

        if (!comparison || comparison.prices.length < 2) {
            return { bestBid: null, bestAsk: null, spread: 0 };
        }

        // For spot prices, we approximate bid/ask as the price itself
        // In reality you'd want order book data
        const sorted = [...comparison.prices].sort((a, b) => a.price - b.price);

        return {
            bestBid: sorted[sorted.length - 1], // Highest price (where to sell)
            bestAsk: sorted[0], // Lowest price (where to buy)
            spread: comparison.spreadPercent,
        };
    }

    // ============================================
    // CACHE HELPERS
    // ============================================

    private getFromCache(key: string): SpotPrice | null {
        const cached = this.cache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.price;
        }
        return null;
    }

    private setCache(key: string, price: SpotPrice): void {
        this.cache.set(key, {
            price,
            expiry: Date.now() + this.cacheTTL,
        });
    }
}

// Singleton export
export const cexPriceFeeds = new CexPriceFeeds();
