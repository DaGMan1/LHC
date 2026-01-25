import { type Address, formatEther } from 'viem';
import {
    priceOracle,
    BASE_POOLS,
    BASE_TOKENS,
    type ArbitrageOpportunity as PriceOracleOpportunity,
} from '../oracles/PriceOracle.js';
import { liquidityMonitor } from '../liquidity.js';
import {
    publicClient,
    isGasPriceAcceptable,
    getGasPriceInfo,
} from '../viemClient.js';
import { intelEmitter } from '../intel.js';

// ============================================
// CONFIGURATION
// ============================================

const MIN_PROFIT_USD = parseFloat(process.env.MIN_PROFIT_USD || '5');
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
}

// ============================================
// ARBITRAGE SCANNER
// ============================================

export class ArbitrageScanner {
    private lastOpportunity: ArbitrageOpportunity | null = null;
    private scanCount: number = 0;

    /**
     * Scan for arbitrage opportunities.
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

        // Scan WETH/USDC pools for arbitrage
        const pools = [
            BASE_POOLS.WETH_USDC_500,
            BASE_POOLS.WETH_USDC_3000,
            BASE_POOLS.WETH_USDC_10000,
        ];

        const arbResult = await priceOracle.findArbitrageOpportunity(pools);

        // Log scan result
        this.log(
            `Block ${blockNumber}: Spread ${arbResult.spreadBps.toFixed(2)} bps, Net ${arbResult.netSpreadBps.toFixed(2)} bps`,
            arbResult.exists ? 'success' : 'info'
        );

        if (!arbResult.exists || !arbResult.buyPool || !arbResult.sellPool) {
            return null;
        }

        // Get pool depths for safe sizing
        const buyPoolDepth = await liquidityMonitor.getPoolDepth(arbResult.buyPool);
        const sellPoolDepth = await liquidityMonitor.getPoolDepth(arbResult.sellPool);

        if (!buyPoolDepth || !sellPoolDepth) {
            this.log('Could not fetch pool depths', 'warning');
            return null;
        }

        // Calculate safe trade size (1% of smaller pool liquidity)
        const minLiquidity =
            buyPoolDepth.liquidity < sellPoolDepth.liquidity
                ? buyPoolDepth.liquidity
                : sellPoolDepth.liquidity;

        const safeSize = liquidityMonitor.getSafeTradeSize(
            { ...buyPoolDepth, liquidity: minLiquidity },
            1 // 1% max impact
        );

        // Cap at MAX_FLASH_LOAN_USD
        const maxSizeWei = BigInt(
            Math.floor((MAX_FLASH_LOAN_USD / ethPriceUsd) * 1e18)
        );
        const recommendedSize = safeSize < maxSizeWei ? safeSize : maxSizeWei;

        // Calculate estimated profit in USD
        const flashAmountEth = Number(formatEther(recommendedSize));
        const estimatedProfitUsd =
            flashAmountEth * ethPriceUsd * (arbResult.netSpreadBps / 10000);

        // Check if profit meets minimum threshold
        if (estimatedProfitUsd < MIN_PROFIT_USD) {
            this.log(
                `Profit too small: $${estimatedProfitUsd.toFixed(2)} < $${MIN_PROFIT_USD}`,
                'info'
            );
            return null;
        }

        // Build opportunity object
        const opportunity: ArbitrageOpportunity = {
            id: `arb-${Date.now()}-${this.scanCount}`,
            timestamp: Date.now(),
            blockNumber,
            asset: BASE_TOKENS.WETH,
            assetSymbol: 'WETH',
            targetToken: BASE_TOKENS.USDC,
            targetSymbol: 'USDC',
            buyPool: arbResult.buyPool,
            sellPool: arbResult.sellPool,
            buyPoolFee: arbResult.buyPoolFee,
            sellPoolFee: arbResult.sellPoolFee,
            spreadBps: arbResult.spreadBps,
            netSpreadBps: arbResult.netSpreadBps,
            estimatedProfitUsd,
            recommendedSize,
            ethPriceUsd,
            isExecutable: true,
        };

        this.lastOpportunity = opportunity;

        this.log(
            `OPPORTUNITY FOUND! Spread: ${arbResult.netSpreadBps.toFixed(2)} bps, Est. Profit: $${estimatedProfitUsd.toFixed(2)}`,
            'success',
            'high'
        );

        return opportunity;
    }

    /**
     * Get the last detected opportunity.
     */
    getLastOpportunity(): ArbitrageOpportunity | null {
        return this.lastOpportunity;
    }

    /**
     * Get scan statistics.
     */
    getStats(): { scanCount: number; lastOpportunity: ArbitrageOpportunity | null } {
        return {
            scanCount: this.scanCount,
            lastOpportunity: this.lastOpportunity,
        };
    }

    /**
     * Log a message to the intel stream.
     */
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
