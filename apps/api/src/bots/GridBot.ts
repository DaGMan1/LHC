import { formatEther } from 'viem';
import { BaseStrategy } from './BaseStrategy.js';
import { GridManager, type GridConfig, type GridState } from '../services/GridManager.js';
import { priceOracle, BASE_POOLS } from '../oracles/PriceOracle.js';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_GRID_CONFIG: GridConfig = {
    lowerPrice: 2800, // Lower bound of grid
    upperPrice: 3200, // Upper bound of grid
    gridCount: 10, // Number of grid levels
    totalCapital: 150, // USD allocated to grid
    asset: '0x4200000000000000000000000000000000000006', // WETH
};

export class GridBot extends BaseStrategy {
    private gridManager: GridManager | null = null;
    private totalGridHits: number = 0;
    private lastState: GridState | null = null;

    constructor() {
        super('grid-bot', 'Dynamic Grid Bot', 1500);
    }

    public async run(): Promise<void> {
        if (this.status !== 'RUNNING') return;

        try {
            const blockNumber = await this.client.getBlockNumber();

            // Initialize grid manager if not exists
            if (!this.gridManager) {
                await this.initializeGrid();
            }

            if (!this.gridManager) {
                this.log('Failed to initialize grid', 'error');
                return;
            }

            // Update grid state
            const { triggered, currentPrice } = await this.gridManager.updateState();
            this.lastState = this.gridManager.getState();

            // Log current state
            this.log(
                `Block ${blockNumber} | Price: $${currentPrice.toFixed(2)} | Grid: ${this.lastState.filledBuys} buys, ${this.lastState.filledSells} sells`,
                'info'
            );

            // Handle triggered levels
            if (triggered.length > 0) {
                this.totalGridHits += triggered.length;

                for (const level of triggered) {
                    const sizeEth = formatEther(level.size);
                    const action = level.type === 'sell' ? 'BUY' : 'SELL';

                    this.log(
                        `GRID ${action} at $${level.price.toFixed(2)} (${sizeEth} ETH)`,
                        'success',
                        'high'
                    );

                    if (this.dryRun) {
                        // Simulate profit from grid spacing
                        const gridSpacing =
                            (DEFAULT_GRID_CONFIG.upperPrice - DEFAULT_GRID_CONFIG.lowerPrice) /
                            DEFAULT_GRID_CONFIG.gridCount;
                        const profitPercent = gridSpacing / level.price;
                        const profit =
                            Number(formatEther(level.size)) * level.price * profitPercent;

                        this.pnl += profit;
                        this.log(
                            `[DRY RUN] Grid profit: +$${profit.toFixed(2)}`,
                            'success'
                        );
                    } else {
                        // Live trading would place actual orders
                        this.log(
                            '[LIVE] Grid trading not implemented - requires LP position management',
                            'warning'
                        );
                    }
                }
            } else {
                this.log(
                    `Price in range. Unrealized PnL: $${this.lastState.unrealizedPnl.toFixed(2)}`,
                    'info'
                );
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Error: ${errorMsg}`, 'error');
        }
    }

    /**
     * Initialize grid with current price
     */
    private async initializeGrid(): Promise<void> {
        // Get current ETH price
        const poolPrice = await priceOracle.getPoolPrice(BASE_POOLS.WETH_USDC_500);
        if (!poolPrice) {
            this.log('Could not fetch current price for grid initialization', 'error');
            return;
        }

        const currentPrice = poolPrice.price * 1e12; // Decimal adjustment

        // Create dynamic grid config centered on current price
        const config = GridManager.getSuggestedConfig(
            currentPrice,
            5, // 5% range each direction
            this.allocated // Use allocated capital
        );

        this.gridManager = new GridManager(config);

        this.log(
            `Grid initialized: $${config.lowerPrice.toFixed(0)} - $${config.upperPrice.toFixed(0)} (${config.gridCount} levels)`,
            'success'
        );
    }

    /**
     * Reset grid to current price
     */
    public async resetGrid(): Promise<void> {
        this.gridManager = null;
        this.totalGridHits = 0;
        await this.initializeGrid();
        this.log('Grid reset to current price', 'warning', 'high');
    }

    /**
     * Get grid statistics
     */
    public getGridStats(): {
        totalGridHits: number;
        state: GridState | null;
    } {
        return {
            totalGridHits: this.totalGridHits,
            state: this.lastState,
        };
    }
}
