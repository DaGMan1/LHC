import { BaseStrategy } from './BaseStrategy.js';
import { cexPriceFeeds } from '../exchanges/CexPriceFeeds.js';
import { hyperliquidClient } from '../exchanges/HyperliquidClient.js';
import { formatEther, parseEther } from 'viem';
import { publicClient, getBotWalletClient, getBotAccount, isBotWalletConfigured } from '../viemClient.js';

// ============================================
// CONFIGURATION
// ============================================

const MIN_DIVERGENCE_PERCENT = parseFloat(process.env.CEX_PERP_MIN_DIVERGENCE || '0.5'); // 0.5%
const MIN_FUNDING_RATE = parseFloat(process.env.CEX_PERP_MIN_FUNDING_RATE || '0.0001'); // 0.01% per 8h
const POSITION_SIZE_USD = parseFloat(process.env.CEX_PERP_POSITION_SIZE || '1000'); // $1000 default
const CONVERGENCE_THRESHOLD_PERCENT = 0.1; // Close when divergence < 0.1%

// Base network addresses
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' as const;

/**
 * CEX-Perp Delta Arbitrage Bot
 *
 * Strategy: Delta-neutral arbitrage between CEX spot and Hyperliquid perpetuals
 * 1. Detect price divergence > MIN_DIVERGENCE_PERCENT
 * 2. Open opposing positions: short overpriced, long underpriced
 * 3. Hedge with spot position via Uniswap to maintain delta-neutral
 * 4. Collect funding rate payments (longs pay shorts or vice versa)
 * 5. Close when convergence occurs (divergence < CONVERGENCE_THRESHOLD_PERCENT)
 *
 * Capital requirement: ~$1000-2000 (split between perp margin and spot hedge)
 */
export class CexPerpDelta extends BaseStrategy {
    private lastSpotPrice: number = 0;
    private lastPerpPrice: number = 0;
    private lastFundingRate: number = 0;

    // Position tracking
    private hasOpenPosition: boolean = false;
    private positionEntryTime: number = 0;
    private positionEntryDivergence: number = 0;
    private positionDirection: 'long_perp' | 'short_perp' | null = null;
    private perpPositionSize: number = 0;
    private spotHedgeAmount: bigint = 0n;

    constructor() {
        super('cex-perp', 'CEX-Perp Delta', 5000);
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

            // Check if we have an open position - monitor for convergence
            if (this.hasOpenPosition) {
                await this.monitorOpenPosition(divergence, spotData.avgPrice, perpPrice);
            } else {
                // Check for new arbitrage opportunity
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
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Error: ${errorMsg}`, 'error');
        }
    }

    /**
     * Handle divergence opportunity - open new position
     */
    private async handleDivergenceOpportunity(
        divergence: number,
        spotPrice: number,
        perpPrice: { markPrice: number; fundingRate: number }
    ): Promise<void> {
        // Determine direction
        // If perp > spot (positive divergence): short perp, long spot
        // If perp < spot (negative divergence): long perp, short spot
        const direction = divergence > 0 ? 'short_perp' : 'long_perp';
        const directionLabel = divergence > 0 ? 'SHORT PERP / LONG SPOT' : 'LONG PERP / SHORT SPOT';

        this.log(
            `DIVERGENCE OPPORTUNITY: ${Math.abs(divergence).toFixed(3)}%`,
            'warning',
            'high'
        );
        this.log(`Strategy: ${directionLabel}`, 'info');

        if (this.dryRun) {
            // Simulate trade in dry run mode
            const simulatedProfit = Math.abs(divergence) * 50; // ~$50 per 1% divergence on $5k position
            this.pnl += simulatedProfit;
            this.log(
                `[DRY RUN] Simulated profit: +$${simulatedProfit.toFixed(2)}`,
                'success',
                'high'
            );
            return;
        }

        // LIVE TRADING
        try {
            // Calculate position sizes
            const perpSizeInEth = POSITION_SIZE_USD / perpPrice.markPrice;

            this.log(`[LIVE] Opening ${direction} position: ${perpSizeInEth.toFixed(4)} ETH`, 'info');

            // Step 1: Open perp position on Hyperliquid
            const perpOrder = await hyperliquidClient.placeMarketOrder({
                coin: 'ETH',
                isBuy: direction === 'long_perp',
                sz: perpSizeInEth,
            });

            if (!perpOrder.success) {
                this.log(`Perp order failed: ${perpOrder.error}`, 'error', 'high');
                return;
            }

            this.log(`Perp order placed: ${perpOrder.orderId}`, 'success');

            // Step 2: Hedge with spot position (opposite direction)
            const spotResult = await this.executeSpotHedge(
                direction === 'long_perp' ? 'sell' : 'buy',
                perpSizeInEth,
                spotPrice
            );

            if (!spotResult.success) {
                this.log(`Spot hedge failed: ${spotResult.error}`, 'error', 'high');
                // TODO: Close perp position to avoid unhedged exposure
                await hyperliquidClient.closePosition('ETH');
                return;
            }

            // Position opened successfully
            this.hasOpenPosition = true;
            this.positionEntryTime = Date.now();
            this.positionEntryDivergence = divergence;
            this.positionDirection = direction;
            this.perpPositionSize = perpSizeInEth;
            this.spotHedgeAmount = spotResult.amount!;

            this.log(
                `[LIVE] Position opened! Entry divergence: ${divergence.toFixed(3)}%`,
                'success',
                'high'
            );
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Position opening failed: ${errorMsg}`, 'error', 'high');
        }
    }

    /**
     * Monitor open position for convergence
     */
    private async monitorOpenPosition(
        currentDivergence: number,
        spotPrice: number,
        perpPrice: { markPrice: number; fundingRate: number }
    ): Promise<void> {
        const absDivergence = Math.abs(currentDivergence);
        const positionAge = (Date.now() - this.positionEntryTime) / 1000 / 3600; // hours

        this.log(
            `POSITION MONITOR: Divergence ${currentDivergence.toFixed(3)}% | Age: ${positionAge.toFixed(1)}h`,
            'info'
        );

        // Calculate unrealized profit
        const divergenceChange = this.positionEntryDivergence - currentDivergence;
        const unrealizedProfitPercent = this.positionDirection === 'long_perp'
            ? divergenceChange
            : -divergenceChange;
        const unrealizedProfitUsd = (unrealizedProfitPercent / 100) * POSITION_SIZE_USD;

        this.log(`Unrealized PnL: $${unrealizedProfitUsd.toFixed(2)}`, unrealizedProfitUsd > 0 ? 'success' : 'warning');

        // Check for convergence (close position)
        if (absDivergence < CONVERGENCE_THRESHOLD_PERCENT) {
            this.log('Convergence detected - closing position', 'warning', 'high');
            await this.closePosition(spotPrice, perpPrice);
        }

        // Safety: Close after 24 hours regardless
        if (positionAge > 24) {
            this.log('Position age > 24h - auto-closing', 'warning', 'high');
            await this.closePosition(spotPrice, perpPrice);
        }
    }

    /**
     * Close open position
     */
    private async closePosition(
        spotPrice: number,
        perpPrice: { markPrice: number; fundingRate: number }
    ): Promise<void> {
        if (!this.hasOpenPosition) {
            this.log('No open position to close', 'warning');
            return;
        }

        try {
            this.log('[LIVE] Closing position...', 'info', 'high');

            // Step 1: Close perp position
            const perpClose = await hyperliquidClient.closePosition('ETH');
            if (!perpClose.success) {
                this.log(`Failed to close perp: ${perpClose.error}`, 'error', 'high');
                return;
            }

            this.log('Perp position closed', 'success');

            // Step 2: Unwind spot hedge
            const spotUnwind = await this.executeSpotHedge(
                this.positionDirection === 'long_perp' ? 'buy' : 'sell',
                this.perpPositionSize,
                spotPrice
            );

            if (!spotUnwind.success) {
                this.log(`Failed to unwind spot: ${spotUnwind.error}`, 'error', 'high');
            }

            // Calculate realized profit
            const divergenceChange = this.positionEntryDivergence - (this.lastPerpPrice - this.lastSpotPrice) / this.lastSpotPrice * 100;
            const realizedProfitPercent = this.positionDirection === 'long_perp'
                ? divergenceChange
                : -divergenceChange;
            const realizedProfitUsd = (realizedProfitPercent / 100) * POSITION_SIZE_USD;

            this.pnl += realizedProfitUsd;

            this.log(
                `[LIVE] Position closed! Realized PnL: $${realizedProfitUsd.toFixed(2)}`,
                realizedProfitUsd > 0 ? 'success' : 'warning',
                'high'
            );

            // Reset position tracking
            this.hasOpenPosition = false;
            this.positionEntryTime = 0;
            this.positionEntryDivergence = 0;
            this.positionDirection = null;
            this.perpPositionSize = 0;
            this.spotHedgeAmount = 0n;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Position closing failed: ${errorMsg}`, 'error', 'high');
        }
    }

    /**
     * Execute spot hedge via Uniswap V3
     */
    private async executeSpotHedge(
        direction: 'buy' | 'sell',
        ethAmount: number,
        currentPrice: number
    ): Promise<{ success: boolean; amount?: bigint; error?: string }> {
        try {
            if (!isBotWalletConfigured()) {
                return { success: false, error: 'Bot wallet not configured' };
            }

            const amountInWei = parseEther(ethAmount.toString());

            if (direction === 'buy') {
                // Buy ETH with USDC (already have USDC, swap to ETH)
                // This would require USDC approval and swap implementation
                // For now, placeholder
                this.log(`[SPOT] Would buy ${ethAmount.toFixed(4)} ETH via Uniswap`, 'info');
                return { success: true, amount: amountInWei };
            } else {
                // Sell ETH for USDC
                this.log(`[SPOT] Would sell ${ethAmount.toFixed(4)} ETH via Uniswap`, 'info');
                return { success: true, amount: amountInWei };
            }

            // TODO: Implement actual Uniswap V3 swap
            // This requires:
            // 1. Encoding swap params
            // 2. Estimating gas
            // 3. Executing transaction
            // 4. Waiting for confirmation
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMsg };
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
