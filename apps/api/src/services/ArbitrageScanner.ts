import { type Address, formatEther } from 'viem';
import {
    priceOracle,
    SCAN_GROUPS,
} from '../oracles/PriceOracle.js';
import { liquidityMonitor } from '../liquidity.js';
import {
    publicClient,
    getGasPriceInfo,
} from '../viemClient.js';
import { intelEmitter } from '../intel.js';

// ============================================
// CONFIGURATION
// ============================================

const MIN_PROFIT_USD = parseFloat(process.env.MIN_PROFIT_USD || '25');
const MIN_NET_SPREAD_BPS = parseFloat(process.env.MIN_NET_SPREAD_BPS || '16');
const MAX_FLASH_LOAN_USD = parseFloat(process.env.MAX_FLASH_LOAN_USD || '10000');

// ============================================
// TYPES
// ============================================

export interface ArbitrageOpportunity {
    id: string;
    timestamp: number;
    blockNumber: bigint;
    asset: Address;
    assetSymbol: string;
    targetToken: Address;
    targetSymbol: string;
    buyPool: Address;
    sellPool: Address;
    buyPoolFee: number;
    sellPoolFee: number;
    spreadBps: number;
    netSpreadBps: number;
    estimatedProfitUsd: number;
    recommendedSize: bigint;
    ethPriceUsd: number;
    isExecutable: boolean;
    reason?: string;
    pairLabel?: string;
}

// ============================================
// ARBITRAGE SCANNER
// ============================================

export class ArbitrageScanner {
    private lastOpportunity: ArbitrageOpportunity | null = null;
    private scanCount: number = 0;

    /**
     * Scan all configured pairs for arbitrage opportunities.
     */
    async scan(): Promise<ArbitrageOpportunity | null> {
        this.scanCount++;
        const blockNumber = await publicClient.getBlockNumber();

        // Check gas price first
        const gasInfo = await getGasPriceInfo();
        if (!gasInfo.acceptable) {
            this.log(
                `Gas too high: ${gasInfo.current} (max: ${gasInfo.max})`,
                'warning'
            );
            return null;
        }

        // Get ETH price for USD calculations
        const ethPriceUsd = await priceOracle.getWethUsdcPrice();
        if (!ethPriceUsd) {
            this.log('Could not fetch ETH price', 'warning');
            return null;
        }

        // Scan ALL pairs across Uniswap V3 + Aerodrome
        const allResults = await priceOracle.scanAllGroups();

        // Log each pair's result
        for (const r of allResults) {
            this.log(
                `Block ${blockNumber} | ${r.pairLabel} (${r.poolCount} pools): ${r.spreadBps.toFixed(2)} bps gross, ${r.netSpreadBps.toFixed(2)} bps net`,
                r.exists ? 'success' : 'info'
            );
        }

        // Find the best opportunity
        let bestResult = allResults[0];
        for (const r of allResults) {
            if (r.netSpreadBps > bestResult.netSpreadBps) bestResult = r;
        }

        if (!bestResult.exists || !bestResult.buyPool || !bestResult.sellPool) {
            return null;
        }

        // Find the matching scan group to get asset/target addresses
        const group = SCAN_GROUPS.find(
            (g) => `${g.asset}/${g.target}` === bestResult.pairLabel
        );
        if (!group) return null;

        // Get pool depths for sizing (optional)
        let buyPoolDepth, sellPoolDepth;
        try {
            [buyPoolDepth, sellPoolDepth] = await Promise.all([
                liquidityMonitor.getPoolDepth(bestResult.buyPool),
                liquidityMonitor.getPoolDepth(bestResult.sellPool),
            ]);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            this.log(`Pool depth fetch failed: ${errMsg}`, 'warning');
        }

        // Calculate flash loan size
        // Strategy: Start with MAX size, scale up for great spreads, reduce only if pool too small
        let recommendedSize: bigint;

        // Base size: Use MAX_FLASH_LOAN_USD
        let targetSizeUsd = MAX_FLASH_LOAN_USD;

        // SCALE UP for exceptional spreads (flash loans are free capital - maximize profit!)
        if (bestResult.netSpreadBps > 15) {
            targetSizeUsd = MAX_FLASH_LOAN_USD * 2; // $20K for >15 bps spreads
            this.log(`Exceptional spread ${bestResult.netSpreadBps.toFixed(2)} bps - scaling to $${targetSizeUsd}`, 'info');
        }

        if (buyPoolDepth && sellPoolDepth) {
            // Check if pools can handle our target size
            const minLiquidity =
                buyPoolDepth.liquidity < sellPoolDepth.liquidity
                    ? buyPoolDepth.liquidity
                    : sellPoolDepth.liquidity;

            const poolMaxSize = liquidityMonitor.getSafeTradeSize(
                { ...buyPoolDepth, liquidity: minLiquidity },
                20 // 20% of pool liquidity (aggressive but safe)
            );

            const poolMaxSizeUsd = Number(formatEther(poolMaxSize)) * ethPriceUsd;

            // Only reduce size if pool is too small
            if (poolMaxSizeUsd < targetSizeUsd) {
                this.log(`Pool too small for $${targetSizeUsd} - reducing to $${poolMaxSizeUsd.toFixed(0)}`, 'info');
                targetSizeUsd = poolMaxSizeUsd;
            }
        } else {
            // Pool depth unavailable - still use target size (flash loan will revert if it fails)
            this.log(`Pool depth unavailable: buy=${!!buyPoolDepth}, sell=${!!sellPoolDepth} - using $${targetSizeUsd} flash loan`, 'info');
        }

        recommendedSize = BigInt(Math.floor((targetSizeUsd / ethPriceUsd) * 1e18));

        // Check if spread meets minimum threshold
        if (bestResult.netSpreadBps < MIN_NET_SPREAD_BPS) {
            this.log(
                `${bestResult.pairLabel} spread too small: ${bestResult.netSpreadBps.toFixed(2)} bps < ${MIN_NET_SPREAD_BPS} bps`,
                'info'
            );
            return null;
        }

        // Calculate estimated profit in USD
        const flashAmountEth = Number(formatEther(recommendedSize));
        const estimatedProfitUsd =
            flashAmountEth * ethPriceUsd * (bestResult.netSpreadBps / 10000);

        // Check if profit meets minimum threshold
        if (estimatedProfitUsd < MIN_PROFIT_USD) {
            this.log(
                `${bestResult.pairLabel} profit too small: $${estimatedProfitUsd.toFixed(2)} < $${MIN_PROFIT_USD}`,
                'info'
            );
            return null;
        }

        // Build opportunity object
        const opportunity: ArbitrageOpportunity = {
            id: `arb-${Date.now()}-${this.scanCount}`,
            timestamp: Date.now(),
            blockNumber,
            asset: group.assetAddress,
            assetSymbol: group.asset,
            targetToken: group.targetAddress,
            targetSymbol: group.target,
            buyPool: bestResult.buyPool,
            sellPool: bestResult.sellPool,
            buyPoolFee: bestResult.buyPoolFee,
            sellPoolFee: bestResult.sellPoolFee,
            spreadBps: bestResult.spreadBps,
            netSpreadBps: bestResult.netSpreadBps,
            estimatedProfitUsd,
            recommendedSize,
            ethPriceUsd,
            isExecutable: true,
            pairLabel: bestResult.pairLabel,
        };

        this.lastOpportunity = opportunity;

        this.log(
            `OPPORTUNITY: ${bestResult.pairLabel} spread ${bestResult.netSpreadBps.toFixed(2)} bps, Est. $${estimatedProfitUsd.toFixed(2)}`,
            'success',
            'high'
        );

        return opportunity;
    }

    getLastOpportunity(): ArbitrageOpportunity | null {
        return this.lastOpportunity;
    }

    getStats(): { scanCount: number; lastOpportunity: ArbitrageOpportunity | null } {
        return {
            scanCount: this.scanCount,
            lastOpportunity: this.lastOpportunity,
        };
    }

    private log(
        msg: string,
        type: 'info' | 'success' | 'warning' | 'error' = 'info',
        priority: 'low' | 'high' = 'low'
    ) {
        const timestamp = new Date().toLocaleTimeString('en-GB', {
            hour12: false,
        });
        intelEmitter.emit('new_intel', {
            time: timestamp,
            msg: `[SCANNER] ${msg}`,
            type,
            priority,
        });
    }
}

// Singleton export
export const arbitrageScanner = new ArbitrageScanner();
