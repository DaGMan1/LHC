import {
    createPublicClient,
    createWalletClient,
    http,
    parseGwei,
    formatEther,
    type WalletClient,
    type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// ============================================
// CONFIGURATION
// ============================================

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY; // Bot wallet, NOT your main wallet
const MAX_GAS_PRICE_GWEI = parseFloat(process.env.MAX_GAS_PRICE_GWEI || '0.1');

// ============================================
// PUBLIC CLIENT (Read-only operations)
// ============================================

export const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
});

// ============================================
// BOT WALLET CLIENT (For autonomous trading)
// ============================================

let _walletClient: WalletClient | null = null;
let _account: Account | null = null;

/**
 * Check if bot wallet is configured for autonomous trading.
 */
export function isBotWalletConfigured(): boolean {
    return !!BOT_PRIVATE_KEY && BOT_PRIVATE_KEY.length > 0;
}

/**
 * Validate private key format.
 * @returns true if valid, false otherwise
 */
function isValidPrivateKey(key: string): boolean {
    // Remove 0x prefix if present
    const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
    // Private key should be 64 hex characters
    return /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

/**
 * Get the bot account from the configured private key.
 * @throws Error if BOT_PRIVATE_KEY is not configured or invalid
 */
export function getBotAccount(): Account {
    if (!BOT_PRIVATE_KEY) {
        throw new Error(
            'BOT_PRIVATE_KEY not configured. Set it in .env for autonomous trading.'
        );
    }

    if (!isValidPrivateKey(BOT_PRIVATE_KEY)) {
        throw new Error(
            'BOT_PRIVATE_KEY is invalid. Must be 64 hex characters (with or without 0x prefix).'
        );
    }

    if (!_account) {
        // Ensure proper format (with or without 0x prefix)
        const key = BOT_PRIVATE_KEY.startsWith('0x')
            ? BOT_PRIVATE_KEY
            : `0x${BOT_PRIVATE_KEY}`;
        _account = privateKeyToAccount(key as `0x${string}`);
    }

    return _account;
}

/**
 * Get the bot wallet client for signing transactions.
 * @throws Error if BOT_PRIVATE_KEY is not configured
 */
export function getBotWalletClient(): WalletClient {
    if (!_walletClient) {
        const account = getBotAccount();
        _walletClient = createWalletClient({
            account,
            chain: base,
            transport: http(RPC_URL),
        });
    }

    return _walletClient;
}

/**
 * Get the bot wallet address.
 * @throws Error if BOT_PRIVATE_KEY is not configured
 */
export function getBotAddress(): `0x${string}` {
    return getBotAccount().address;
}

// ============================================
// GAS UTILITIES
// ============================================

/**
 * Get current gas price from the network.
 */
export async function getGasPrice(): Promise<bigint> {
    return publicClient.getGasPrice();
}

/**
 * Check if current gas price is acceptable for trading.
 */
export async function isGasPriceAcceptable(): Promise<boolean> {
    const gasPrice = await getGasPrice();
    const maxGasPrice = parseGwei(MAX_GAS_PRICE_GWEI.toString());
    return gasPrice <= maxGasPrice;
}

/**
 * Get gas price info formatted for logging.
 */
export async function getGasPriceInfo(): Promise<{
    current: string;
    max: string;
    acceptable: boolean;
}> {
    const gasPrice = await getGasPrice();
    const maxGasPrice = parseGwei(MAX_GAS_PRICE_GWEI.toString());
    const gasPriceGwei = Number(gasPrice) / 1e9;

    return {
        current: `${gasPriceGwei.toFixed(6)} gwei`,
        max: `${MAX_GAS_PRICE_GWEI} gwei`,
        acceptable: gasPrice <= maxGasPrice,
    };
}

// ============================================
// BALANCE UTILITIES
// ============================================

/**
 * Get ETH balance for the bot wallet.
 * @throws Error if bot wallet is not configured
 */
export async function getBotWalletBalance(): Promise<bigint> {
    const address = getBotAddress();
    return publicClient.getBalance({ address });
}

/**
 * Get formatted bot wallet balance info.
 */
export async function getBotWalletInfo(): Promise<{
    address: string;
    balanceWei: string;
    balanceEth: string;
}> {
    const address = getBotAddress();
    const balance = await publicClient.getBalance({ address });

    return {
        address,
        balanceWei: balance.toString(),
        balanceEth: formatEther(balance),
    };
}

/**
 * Check if bot wallet has sufficient balance for gas.
 * @param minBalanceEth Minimum balance in ETH (default: 0.001)
 */
export async function hasSufficientGas(
    minBalanceEth: number = 0.001
): Promise<boolean> {
    const balance = await getBotWalletBalance();
    const minBalanceWei = BigInt(Math.floor(minBalanceEth * 1e18));
    return balance >= minBalanceWei;
}

// ============================================
// BLOCK UTILITIES
// ============================================

/**
 * Get current block number.
 */
export async function getBlockNumber(): Promise<bigint> {
    return publicClient.getBlockNumber();
}
