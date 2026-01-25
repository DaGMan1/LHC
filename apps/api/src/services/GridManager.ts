import { type Address, formatEther, parseEther } from 'viem';
import { priceOracle, BASE_POOLS } from '../oracles/PriceOracle.js';

// ============================================
// TYPES
// ============================================

export interface GridLevel {
    id: string;
    price: number;
    type: 'buy' | 'sell';
    size: bigint;
    filled: boolean;
    filledAt?: number;
}

export interface GridConfig {
    lowerPrice: number;
    upperPrice: number;
    gridCount: number;
    totalCapital: number; // In USD
    asset: Address;
}

export interface GridState {
    levels: GridLevel[];
    currentPrice: number;
    totalInvested: number;
    unrealizedPnl: number;
    filledBuys: number;
    filledSells: number;
}

// ============================================
// GRID MANAGER
// ============================================

export class GridManager {
    private config: GridConfig;
    private levels: GridLevel[] = [];
    private lastPrice: number = 0;

    constructor(config: GridConfig) {
        this.config = config;
        this.initializeGrid();
    }

    /**
     * Initialize grid levels based on configuration
     */
    private initializeGrid(): void {
        const { lowerPrice, upperPrice, gridCount, totalCapital } = this.config;

        const priceStep = (upperPrice - lowerPrice) / gridCount;
        const capitalPerLevel = totalCapital / gridCount;

        this.levels = [];

        for (let i = 0; i <= gridCount; i++) {
            const price = lowerPrice + i * priceStep;
            const sizeUsd = capitalPerLevel;
            const sizeEth = sizeUsd / price;

            this.levels.push({
                id: `grid-${i}`,
                price,
                type: 'buy', // All levels start as buy orders
                size: parseEther(sizeEth.toFixed(18)),
                filled: false,
            });
        }
    }

    /**
     * Update grid state based on current price
     */
    async updateState(): Promise<{
        triggered: GridLevel[];
        currentPrice: number;
    }> {
        // Get current price
        const poolPrice = await priceOracle.getPoolPrice(BASE_POOLS.WETH_USDC_500);
        if (!poolPrice) {
            return { triggered: [], currentPrice: this.lastPrice };
        }

        // Convert to WETH price in USD (adjust for decimals)
        const currentPrice = poolPrice.price * 1e12; // WETH/USDC decimal adjustment

        const triggered: GridLevel[] = [];

        // Check each level
        for (const level of this.levels) {
            if (level.filled) continue;

            // Buy level triggered when price drops below
            if (level.type === 'buy' && currentPrice <= level.price) {
                level.filled = true;
                level.filledAt = Date.now();
                level.type = 'sell'; // Now becomes a sell order at higher price
                triggered.push(level);
            }
            // Sell level triggered when price rises above
            else if (level.type === 'sell' && currentPrice >= level.price) {
                level.filled = true;
                level.filledAt = Date.now();
                level.type = 'buy'; // Reset to buy at this level
                level.filled = false; // Ready for next cycle
                triggered.push(level);
            }
        }

        this.lastPrice = currentPrice;

        return { triggered, currentPrice };
    }

    /**
     * Get current grid state
     */
    getState(): GridState {
        const filledBuys = this.levels.filter(
            (l) => l.filled && l.type === 'sell'
        ).length;
        const filledSells = this.levels.filter(
            (l) => l.filled && l.type === 'buy'
        ).length;

        // Calculate unrealized PnL
        // For each filled buy, we have ETH. PnL = current_price - buy_price
        let unrealizedPnl = 0;
        for (const level of this.levels) {
            if (level.filled && level.type === 'sell') {
                // We bought at level.price, now worth lastPrice
                const sizEth = Number(formatEther(level.size));
                unrealizedPnl += sizEth * (this.lastPrice - level.price);
            }
        }

        return {
            levels: this.levels,
            currentPrice: this.lastPrice,
            totalInvested: this.config.totalCapital,
            unrealizedPnl,
            filledBuys,
            filledSells,
        };
    }

    /**
     * Calculate grid profit from completed round trips
     */
    calculateProfit(): number {
        // Each completed round trip (buy then sell) earns the grid spacing
        const priceStep =
            (this.config.upperPrice - this.config.lowerPrice) / this.config.gridCount;
        const capitalPerLevel = this.config.totalCapital / this.config.gridCount;

        // Profit per completed grid = (price_step / avg_price) * capital
        const avgPrice = (this.config.upperPrice + this.config.lowerPrice) / 2;
        const profitPerGrid = (priceStep / avgPrice) * capitalPerLevel;

        // Count completed round trips (would need to track this properly)
        // For now, return based on filled sells
        const completedGrids = this.levels.filter(
            (l) => l.filledAt && l.type === 'buy'
        ).length;

        return completedGrids * profitPerGrid;
    }

    /**
     * Reset grid to initial state
     */
    reset(): void {
        this.initializeGrid();
        this.lastPrice = 0;
    }

    /**
     * Get suggested grid parameters based on current volatility
     */
    static getSuggestedConfig(
        currentPrice: number,
        volatilityPercent: number = 5,
        capitalUsd: number = 150
    ): GridConfig {
        // Grid range = current price +/- volatility
        const lowerPrice = currentPrice * (1 - volatilityPercent / 100);
        const upperPrice = currentPrice * (1 + volatilityPercent / 100);

        // More grids for tighter range, fewer for wider
        const gridCount = Math.min(Math.max(Math.floor(capitalUsd / 15), 5), 20);

        return {
            lowerPrice,
            upperPrice,
            gridCount,
            totalCapital: capitalUsd,
            asset: '0x4200000000000000000000000000000000000006' as Address, // WETH
        };
    }
}
