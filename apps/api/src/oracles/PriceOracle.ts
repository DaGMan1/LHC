import { type Address, parseAbi } from 'viem';
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
// AERODROME POOL ABI (Uniswap V2-style)
// ============================================

const AERODROME_POOL_ABI = parseAbi([
    'function getReserves() external view returns (uint256 _reserve0, uint256 _reserve1, uint256 _blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function stable() external view returns (bool)',
]);

// ============================================
// BASE MAINNET ADDRESSES
// ============================================

export const BASE_TOKENS = {
    WETH: '0x4200000000000000000000000000000000000006' as Address,
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' as Address,
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as Address,
    cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' as Address,
};

export const TOKEN_DECIMALS: Record<string, number> = {
    WETH: 18,
    USDC: 6,
    USDbC: 6,
    DAI: 18,
    cbETH: 18,
};

// Uniswap V3 pools on Base
export const BASE_POOLS = {
    WETH_USDC_500: '0xd0b53D9277642d899DF5C87A3966A349A798F224' as Address,
    WETH_USDC_3000: '0x4C36388bE6F6544901f4095493B0743bF00902c6' as Address,
    WETH_USDC_10000: '0x8ad86F1b4B8D17D00Cf89B91d6dc95F64f5fDe4f' as Address,
    WETH_USDbC_500: '0x4b0Aaf3EBb163DD45F663b38b6d93f6093EBC2d3' as Address,
    WETH_USDbC_3000: '0x82a8c1511d48F0CCB7e2b054A37580b5252Bb421' as Address,
    WETH_DAI_3000: '0x927860797d07b1C46fbBe7f6f73D45C7E1BFBb27' as Address,
    cbETH_WETH_500: '0x257FcbAE4Ac6B26A02E4FC5e1a11e4174b5ce395' as Address,
};

// Aerodrome pools on Base (V2-style AMM)
export const AERODROME_POOLS = {
    WETH_USDC_VOLATILE: '0xcDAC0d6c6C59727a65F871236188350531885C43' as Address,
    WETH_USDbC_VOLATILE: '0xB4885Bc63399BF5518b994c1d0C153334Ee579D0' as Address,
    USDC_USDbC_STABLE: '0x27a8Afa3Bd49406e48a074350fB7b2020c43B2bD' as Address,
};

// ============================================
// SCAN GROUPS
// ============================================

export interface ScanGroup {
    asset: string;
    assetAddress: Address;
    target: string;
    targetAddress: Address;
    uniV3Pools: Address[];
    aerodromePools: Address[];
    decimalAdjustment: number;
}

export const SCAN_GROUPS: ScanGroup[] = [
    {
        asset: 'WETH', assetAddress: BASE_TOKENS.WETH,
        target: 'USDC', targetAddress: BASE_TOKENS.USDC,
        uniV3Pools: [BASE_POOLS.WETH_USDC_500, BASE_POOLS.WETH_USDC_3000, BASE_POOLS.WETH_USDC_10000],
        aerodromePools: [AERODROME_POOLS.WETH_USDC_VOLATILE],
        decimalAdjustment: 10 ** (TOKEN_DECIMALS.WETH - TOKEN_DECIMALS.USDC),
    },
    {
        asset: 'WETH', assetAddress: BASE_TOKENS.WETH,
        target: 'USDbC', targetAddress: BASE_TOKENS.USDbC,
        uniV3Pools: [BASE_POOLS.WETH_USDbC_500, BASE_POOLS.WETH_USDbC_3000],
        aerodromePools: [AERODROME_POOLS.WETH_USDbC_VOLATILE],
        decimalAdjustment: 10 ** (TOKEN_DECIMALS.WETH - TOKEN_DECIMALS.USDbC),
    },
    {
        asset: 'WETH', assetAddress: BASE_TOKENS.WETH,
        target: 'DAI', targetAddress: BASE_TOKENS.DAI,
        uniV3Pools: [BASE_POOLS.WETH_DAI_3000],
        aerodromePools: [],
        decimalAdjustment: 1,
    },
    {
        asset: 'cbETH', assetAddress: BASE_TOKENS.cbETH,
        target: 'WETH', targetAddress: BASE_TOKENS.WETH,
        uniV3Pools: [BASE_POOLS.cbETH_WETH_500],
        aerodromePools: [],
        decimalAdjustment: 1,
    },
];

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
    dex: 'uniswap-v3' | 'aerodrome';
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
    pairLabel?: string;
}

// ============================================
// STATIC POOL METADATA CACHE
// token0, token1, fee never change — fetch once and cache forever
// ============================================

interface PoolMeta {
    token0: Address;
    token1: Address;
    fee: number;
}

const uniV3MetaCache = new Map<Address, PoolMeta>();
const aeroMetaCache = new Map<Address, { token0: Address; token1: Address }>();

// ============================================
// PRICE ORACLE
// ============================================

export class PriceOracle {
    /**
     * Fetch and cache static metadata for a Uni V3 pool.
     */
    private async getUniV3Meta(poolAddress: Address): Promise<PoolMeta> {
        const cached = uniV3MetaCache.get(poolAddress);
        if (cached) return cached;

        const [token0, token1, fee] = await Promise.all([
            publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token0' }),
            publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token1' }),
            publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'fee' }),
        ]);

        const meta: PoolMeta = {
            token0: token0 as Address,
            token1: token1 as Address,
            fee: Number(fee),
        };
        uniV3MetaCache.set(poolAddress, meta);
        return meta;
    }

    /**
     * Fetch and cache static metadata for an Aerodrome pool.
     */
    private async getAeroMeta(poolAddress: Address): Promise<{ token0: Address; token1: Address }> {
        const cached = aeroMetaCache.get(poolAddress);
        if (cached) return cached;

        const [token0, token1] = await Promise.all([
            publicClient.readContract({ address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'token0' }),
            publicClient.readContract({ address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'token1' }),
        ]);

        const meta = { token0: token0 as Address, token1: token1 as Address };
        aeroMetaCache.set(poolAddress, meta);
        return meta;
    }

    /**
     * Get price data from a Uniswap V3 pool (only 2 RPC calls after first run).
     */
    async getPoolPrice(poolAddress: Address): Promise<PoolPrice | null> {
        try {
            const [meta, slot0, liquidity] = await Promise.all([
                this.getUniV3Meta(poolAddress),
                publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'slot0' }),
                publicClient.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'liquidity' }),
            ]);

            const sqrtPriceX96 = slot0[0] as bigint;
            const tick = Number(slot0[1]);

            const Q96 = 2n ** 96n;
            const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);

            return {
                poolAddress,
                fee: meta.fee,
                sqrtPriceX96,
                price,
                liquidity: liquidity as bigint,
                token0: meta.token0,
                token1: meta.token1,
                tick,
                dex: 'uniswap-v3',
            };
        } catch (error) {
            console.error(`Error fetching Uni V3 price for ${poolAddress}:`, error);
            return null;
        }
    }

    /**
     * Get price data from an Aerodrome pool (only 1 RPC call after first run).
     */
    async getAerodromePoolPrice(poolAddress: Address): Promise<PoolPrice | null> {
        try {
            const [meta, reserves] = await Promise.all([
                this.getAeroMeta(poolAddress),
                publicClient.readContract({ address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'getReserves' }),
            ]);

            const reserve0 = reserves[0] as bigint;
            const reserve1 = reserves[1] as bigint;

            if (reserve0 === 0n || reserve1 === 0n) return null;

            const price = Number(reserve1) / Number(reserve0);

            return {
                poolAddress,
                fee: 30, // Aerodrome volatile ~0.30%
                sqrtPriceX96: 0n,
                price,
                liquidity: reserve0,
                token0: meta.token0,
                token1: meta.token1,
                tick: 0,
                dex: 'aerodrome',
            };
        } catch (error) {
            console.error(`Error fetching Aerodrome price for ${poolAddress}:`, error);
            return null;
        }
    }

    async getMultiplePoolPrices(pools: Address[]): Promise<PoolPrice[]> {
        const prices = await Promise.all(pools.map((p) => this.getPoolPrice(p)));
        return prices.filter((p): p is PoolPrice => p !== null);
    }

    async getMultipleAerodromePrices(pools: Address[]): Promise<PoolPrice[]> {
        const prices = await Promise.all(pools.map((p) => this.getAerodromePoolPrice(p)));
        return prices.filter((p): p is PoolPrice => p !== null);
    }

    async getAllPricesForGroup(group: ScanGroup): Promise<PoolPrice[]> {
        const [uniPrices, aeroPrices] = await Promise.all([
            this.getMultiplePoolPrices(group.uniV3Pools),
            group.aerodromePools.length > 0
                ? this.getMultipleAerodromePrices(group.aerodromePools)
                : Promise.resolve([]),
        ]);
        return [...uniPrices, ...aeroPrices];
    }

    async findArbitrageOpportunity(pools: Address[]): Promise<ArbitrageOpportunity> {
        const prices = await this.getMultiplePoolPrices(pools);
        if (prices.length < 2) {
            return { exists: false, spreadBps: 0, netSpreadBps: 0, buyPool: null, sellPool: null, buyPoolFee: 0, sellPoolFee: 0, estimatedProfitPercent: 0 };
        }
        return this.findSpreadFromPrices(prices);
    }

    findSpreadFromPrices(prices: PoolPrice[]): ArbitrageOpportunity {
        if (prices.length < 2) {
            return { exists: false, spreadBps: 0, netSpreadBps: 0, buyPool: null, sellPool: null, buyPoolFee: 0, sellPoolFee: 0, estimatedProfitPercent: 0 };
        }

        let minPrice = prices[0];
        let maxPrice = prices[0];
        for (const p of prices) {
            if (p.price < minPrice.price) minPrice = p;
            if (p.price > maxPrice.price) maxPrice = p;
        }

        const spreadBps = ((maxPrice.price - minPrice.price) / minPrice.price) * 10000;
        const flashLoanPremiumBps = 5;
        const totalFeeBps = minPrice.fee / 100 + maxPrice.fee / 100 + flashLoanPremiumBps;
        const netSpreadBps = spreadBps - totalFeeBps;
        const exists = netSpreadBps > 5;

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

    async scanAllGroups(): Promise<(ArbitrageOpportunity & { pairLabel: string; poolCount: number })[]> {
        return Promise.all(
            SCAN_GROUPS.map(async (group) => {
                const prices = await this.getAllPricesForGroup(group);
                const opp = this.findSpreadFromPrices(prices);
                return { ...opp, pairLabel: `${group.asset}/${group.target}`, poolCount: prices.length };
            })
        );
    }

    async findBestOpportunity(): Promise<ArbitrageOpportunity & { pairLabel: string }> {
        const results = await this.scanAllGroups();
        let best = results[0];
        for (const r of results) {
            if (r.netSpreadBps > best.netSpreadBps) best = r;
        }
        return best;
    }

    async getWethUsdcPrice(): Promise<number | null> {
        const price = await this.getPoolPrice(BASE_POOLS.WETH_USDC_500);
        if (!price) return null;
        const decimalAdj = 10 ** (TOKEN_DECIMALS.WETH - TOKEN_DECIMALS.USDC);
        return price.price * decimalAdj;
    }
}

export const priceOracle = new PriceOracle();
