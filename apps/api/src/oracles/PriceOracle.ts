import { type Address } from 'viem';
import { publicClient } from '../viemClient.js';

// ============================================
// UNISWAP V3 POOL ABI
// ============================================

const POOL_ABI = [
    {
        name: 'slot0',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'sqrtPriceX96', type: 'uint160' },
            { name: 'tick', type: 'int24' },
            { name: 'observationIndex', type: 'uint16' },
            { name: 'observationCardinality', type: 'uint16' },
            { name: 'observationCardinalityNext', type: 'uint16' },
            { name: 'feeProtocol', type: 'uint8' },
            { name: 'unlocked', type: 'bool' },
        ],
    },
    {
        name: 'liquidity',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint128' }],
    },
    {
        name: 'token0',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'token1',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'fee',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint24' }],
    },
] as const;

// ============================================
// BASE MAINNET ADDRESSES
// ============================================

export const BASE_TOKENS = {
    WETH: '0x4200000000000000000000000000000000000006' as Address,
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' as Address, // Bridged USDC
};

// Uniswap V3 pools on Base
export const BASE_POOLS = {
    // WETH/USDC pools
    WETH_USDC_500: '0xd0b53D9277642d899DF5C87A3966A349A798F224' as Address,   // 0.05% fee
    WETH_USDC_3000: '0x4C36388bE6F6544901f4095493B0743bF00902c6' as Address,  // 0.30% fee
    WETH_USDC_10000: '0x8ad86F1b4B8D17D00Cf89B91d6dc95F64f5fDe4f' as Address, // 1.00% fee
};

// ============================================
// TYPES
// ============================================

export interface PoolPrice {
    poolAddress: Address;
    fee: number;
    sqrtPriceX96: bigint;
    price: number;
    liquidity: bigint;
    token0: Address;
    token1: Address;
    tick: number;
}

export interface ArbitrageOpportunity {
    exists: boolean;
    spreadBps: number;
    netSpreadBps: number;
    buyPool: Address | null;
    sellPool: Address | null;
    buyPoolFee: number;
    sellPoolFee: number;
    estimatedProfitPercent: number;
}

// ============================================
// PRICE ORACLE
// ============================================

export class PriceOracle {
    /**
     * Get price data from a Uniswap V3 pool.
     */
    async getPoolPrice(poolAddress: Address): Promise<PoolPrice | null> {
        try {
            const [slot0, liquidity, token0, token1, fee] = await Promise.all([
                publicClient.readContract({
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'slot0',
                }),
                publicClient.readContract({
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'liquidity',
                }),
                publicClient.readContract({
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'token0',
                }),
                publicClient.readContract({
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'token1',
                }),
                publicClient.readContract({
                    address: poolAddress,
                    abi: POOL_ABI,
                    functionName: 'fee',
                }),
            ]);

            const sqrtPriceX96 = slot0[0] as bigint;
            const tick = Number(slot0[1]);

            // Convert sqrtPriceX96 to price
            // price = (sqrtPriceX96 / 2^96)^2
            // For numerical stability, we compute this differently
            const Q96 = 2n ** 96n;
            const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);

            return {
                poolAddress,
                fee: Number(fee),
                sqrtPriceX96,
                price,
                liquidity: liquidity as bigint,
                token0: token0 as Address,
                token1: token1 as Address,
                tick,
            };
        } catch (error) {
            console.error(`Error fetching price for ${poolAddress}:`, error);
            return null;
        }
    }

    /**
     * Get prices from multiple pools in parallel.
     */
    async getMultiplePoolPrices(pools: Address[]): Promise<PoolPrice[]> {
        const prices = await Promise.all(
            pools.map((pool) => this.getPoolPrice(pool))
        );
        return prices.filter((p): p is PoolPrice => p !== null);
    }

    /**
     * Find arbitrage opportunities between pools.
     */
    async findArbitrageOpportunity(
        pools: Address[]
    ): Promise<ArbitrageOpportunity> {
        const prices = await this.getMultiplePoolPrices(pools);

        if (prices.length < 2) {
            return {
                exists: false,
                spreadBps: 0,
                netSpreadBps: 0,
                buyPool: null,
                sellPool: null,
                buyPoolFee: 0,
                sellPoolFee: 0,
                estimatedProfitPercent: 0,
            };
        }

        // Find min and max prices
        let minPrice = prices[0];
        let maxPrice = prices[0];

        for (const p of prices) {
            if (p.price < minPrice.price) minPrice = p;
            if (p.price > maxPrice.price) maxPrice = p;
        }

        // Calculate gross spread in basis points
        const spreadBps =
            ((maxPrice.price - minPrice.price) / minPrice.price) * 10000;

        // Calculate total fees (both pool fees + flash loan premium 0.05%)
        const flashLoanPremiumBps = 5; // 0.05%
        const totalFeeBps =
            minPrice.fee / 100 + maxPrice.fee / 100 + flashLoanPremiumBps;

        // Net spread after fees
        const netSpreadBps = spreadBps - totalFeeBps;

        // Need at least 10 bps (0.1%) profit to be worth it
        const exists = netSpreadBps > 10;

        return {
            exists,
            spreadBps,
            netSpreadBps,
            buyPool: exists ? minPrice.poolAddress : null,
            sellPool: exists ? maxPrice.poolAddress : null,
            buyPoolFee: minPrice.fee,
            sellPoolFee: maxPrice.fee,
            estimatedProfitPercent: netSpreadBps / 100,
        };
    }

    /**
     * Get WETH price in USDC.
     * Returns the price from the most liquid pool.
     */
    async getWethUsdcPrice(): Promise<number | null> {
        const price = await this.getPoolPrice(BASE_POOLS.WETH_USDC_500);
        if (!price) return null;

        // WETH is usually token0, USDC is token1
        // If sqrtPriceX96 gives token1/token0, we need to handle decimals
        // WETH has 18 decimals, USDC has 6 decimals
        // Adjustment factor: 10^(18-6) = 10^12
        const decimalAdjustment = 1e12;
        const ethPriceInUsdc = price.price * decimalAdjustment;

        return ethPriceInUsdc;
    }
}

// Singleton export
export const priceOracle = new PriceOracle();
