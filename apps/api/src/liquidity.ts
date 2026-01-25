import { parseAbi } from 'viem';
import { publicClient } from './viemClient.js';

const POOL_ABI = parseAbi([
    'function liquidity() external view returns (uint128)',
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
]);

export interface PoolDepth {
    poolAddress: string;
    liquidity: bigint;
    sqrtPriceX96: bigint;
    tick: number;
}

export class LiquidityMonitor {
    /**
     * Fetches the current depth of a Uniswap V3 pool on Base.
     */
    async getPoolDepth(poolAddress: `0x${string}`): Promise<PoolDepth | null> {
        try {
            const [liquidity, slot0] = await Promise.all([
                publicClient.readContract({
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'liquidity',
                }),
                publicClient.readContract({
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'slot0',
                }),
            ]);

            return {
                poolAddress,
                liquidity,
                sqrtPriceX96: slot0[0],
                tick: slot0[1],
            };
        } catch (error) {
            console.error(`[LiquidityMonitor] Error fetching depth for ${poolAddress}:`, error);
            return null;
        }
    }

    /**
     * Calculates the maximum safe trade size (e.g., 2% of liquidity)
     * This is a simplified version; real slippage math is more complex.
     */
    getSafeTradeSize(depth: PoolDepth, maxImpactPercent: number = 2): bigint {
        return (depth.liquidity * BigInt(maxImpactPercent)) / BigInt(100);
    }
}

export const liquidityMonitor = new LiquidityMonitor();
