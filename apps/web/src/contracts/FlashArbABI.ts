export const FLASH_ARB_ABI = [
    {
        type: 'constructor',
        inputs: [
            { name: '_poolProvider', type: 'address' },
            { name: '_swapRouter', type: 'address' },
        ],
    },
    {
        name: 'requestFlashLoan',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: '_token', type: 'address' },
            { name: '_amount', type: 'uint256' },
            { name: '_params', type: 'bytes' },
        ],
        outputs: [],
    },
    {
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: '_token', type: 'address' }],
        outputs: [],
    },
    {
        name: 'withdrawETH',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
    },
    {
        name: 'setPaused',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: '_paused', type: 'bool' }],
        outputs: [],
    },
    {
        name: 'paused',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'OWNER',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'getBalance',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_token', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'ArbitrageExecuted',
        type: 'event',
        inputs: [
            { name: 'asset', type: 'address', indexed: true },
            { name: 'flashAmount', type: 'uint256', indexed: false },
            { name: 'profit', type: 'uint256', indexed: false },
            { name: 'timestamp', type: 'uint256', indexed: false },
        ],
    },
] as const;

// Base Mainnet addresses (checksummed)
export const BASE_ADDRESSES = {
    AAVE_POOL_PROVIDER: '0xE20FCBDBFfc4dD138ce8b65639900B6e1fA9F5F8' as `0x${string}`,
    UNISWAP_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481' as `0x${string}`,
    WETH: '0x4200000000000000000000000000000000000006' as `0x${string}`,
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
};
