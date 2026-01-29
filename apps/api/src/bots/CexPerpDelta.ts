import { BaseStrategy } from './BaseStrategy.js';
import { cexPriceFeeds } from '../exchanges/CexPriceFeeds.js';
import { hyperliquidClient } from '../exchanges/HyperliquidClient.js';

// ============================================
// CONFIGURATION
// ============================================

const MIN_DIVERGENCE_PERCENT = 0.5; // Minimum divergence to trigger (0.5%)
const MIN_FUNDING_RATE = 0.0001; // Minimum funding rate (0.01% per 8h)

/**
 * CEX-Perp Delta Arbitrage Bot
 *
 * SIMULATION ONLY - Live trading not implemented.
 * This bot monitors divergence between CEX spot prices and Hyperliquid perpetuals,
 * identifies funding rate arbitrage opportunities, and simulates trades.
 *
 * To implement live trading:
 * - Integrate Hyperliquid SDK for order placement
 * - Add spot hedging via DEX or CEX API
 * - Implement position monitoring and convergence detection
 */
export class CexPerpDelta extends BaseStrategy {
    private lastSpotPrice: number = 0;
    private lastPerpPrice: number = 0;
    private lastFundingRate: number = 0;

    constructor() {
        // Note: This bot always runs in simulation mode - live trading not implemented
        super('cex-perp', 'CEX-Perp Delta (Simulation)', 5000);
    }

    public async run(): Promise<void> {
        if (this.status !== 'RUNNING') return;

        try {
            const blockNumber = await this.client.getBlockNumber();

            // Fetch spot prices from CEX
            const spotData = await cexPriceFeeds.getAggregatedPrice('ETH');
            if (!spotData) {
                this.log('Could not fetch CEX spot prices', 'warning');
                return;
            }

            // Fetch perp price from Hyperliquid
            const perpPrice = await hyperliquidClient.getEthPerpPrice();
            if (!perpPrice) {
                this.log('Could not fetch Hyperliquid perp price', 'warning');
                return;
            }

            // Store for display
            this.lastSpotPrice = spotData.avgPrice;
            this.lastPerpPrice = perpPrice.markPrice;
            this.lastFundingRate = perpPrice.fundingRate;

            // Calculate divergence
            const divergence =
                ((perpPrice.markPrice - spotData.avgPrice) / spotData.avgPrice) * 100;
            const absDivergence = Math.abs(divergence);

            // Log current state
            this.log(
                `Block ${blockNumber} | Spot: $${spotData.avgPrice.toFixed(2)} | Perp: $${perpPrice.markPrice.toFixed(2)}`,
                'info'
            );
            this.log(
                `Divergence: ${divergence.toFixed(3)}% | Funding: ${(perpPrice.fundingRate * 100).toFixed(4)}%`,
                absDivergence > MIN_DIVERGENCE_PERCENT ? 'warning' : 'info'
            );

            // Check for arbitrage opportunity
            if (absDivergence > MIN_DIVERGENCE_PERCENT) {
                await this.handleDivergenceOpportunity(divergence, spotData.avgPrice, perpPrice);
            }

            // Check for funding rate opportunity
            const fundingArb = await hyperliquidClient.getFundingArbOpportunity('ETH');
            if (fundingArb.exists) {
                this.log(
                    `Funding Arb: ${fundingArb.direction} perp | APY: ${fundingArb.annualizedYield.toFixed(2)}%`,
                    'success'
                );
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Error: ${errorMsg}`, 'error');
        }
    }

    /**
     * Handle divergence opportunity
     */
    private async handleDivergenceOpportunity(
        divergence: number,
        spotPrice: number,
        perpPrice: { markPrice: number; fundingRate: number }
    ): Promise<void> {
        // Determine direction
        // If perp > spot (positive divergence): short perp, long spot
        // If perp < spot (negative divergence): long perp, short spot
        const direction = divergence > 0 ? 'SHORT PERP / LONG SPOT' : 'LONG PERP / SHORT SPOT';

        this.log(
            `DIVERGENCE OPPORTUNITY: ${Math.abs(divergence).toFixed(3)}%`,
            'warning',
            'high'
        );
        this.log(`Suggested: ${direction}`, 'info');

        if (this.dryRun) {
            // Simulate trade in dry run mode
            const simulatedProfit = Math.abs(divergence) * 50; // ~$50 per 1% divergence on $5k position
            this.pnl += simulatedProfit;
            this.log(
                `[DRY RUN] Simulated profit: +$${simulatedProfit.toFixed(2)}`,
                'success',
                'high'
            );
        } else {
            // Live trading would go here
            // For now, just log that we detected an opportunity
            this.log(
                '[LIVE] Trading not implemented - Hyperliquid requires wallet integration',
                'warning'
            );
            // TODO: Implement actual Hyperliquid order placement
            // This requires:
            // 1. Opening position on Hyperliquid
            // 2. Hedging on spot (via Uniswap or holding)
            // 3. Closing when convergence occurs
        }
    }

    /**
     * Get current market state for display
     */
    public getMarketState(): {
        spotPrice: number;
        perpPrice: number;
        fundingRate: number;
        divergence: number;
    } {
        const divergence =
            this.lastSpotPrice > 0
                ? ((this.lastPerpPrice - this.lastSpotPrice) / this.lastSpotPrice) * 100
                : 0;

        return {
            spotPrice: this.lastSpotPrice,
            perpPrice: this.lastPerpPrice,
            fundingRate: this.lastFundingRate,
            divergence,
        };
    }
}
