import {
    type Address,
    encodeAbiParameters,
    parseAbiParameters,
} from 'viem';
import { base } from 'viem/chains';
import {
    publicClient,
    getBotWalletClient,
    getBotAddress,
    isGasPriceAcceptable,
    hasSufficientGas,
    isBotWalletConfigured,
} from '../viemClient.js';
import { getContractAddress, isContractConfigured } from '../config/runtimeConfig.js';

// ============================================
// CONTRACT ABI (minimal interface)
// ============================================

const FLASH_ARB_ABI = [
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
        name: 'paused',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'isExecutor',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '_address', type: 'address' }],
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

// ============================================
// TYPES
// ============================================

export interface FlashLoanParams {
    /** Token to borrow (e.g., WETH) */
    asset: Address;
    /** Amount to borrow in wei */
    amount: bigint;
    /** Token to swap to (e.g., USDC) */
    targetToken: Address;
    /** Uniswap pool fee tier (500, 3000, 10000) */
    poolFee: number;
    /** Minimum amount to receive after both swaps (slippage protection) */
    minAmountOut: bigint;
}

export interface ExecutionResult {
    success: boolean;
    txHash: `0x${string}`;
    gasUsed?: bigint;
    profit?: bigint;
    error?: string;
}

// ============================================
// FLASH ARB CLIENT
// ============================================

export class FlashArbClient {
    private contractAddress: Address;

    constructor(address?: string) {
        // Use provided address, or get from runtime config, or fall back to env
        const contractAddr = address || getContractAddress() || process.env.FLASH_ARB_CONTRACT_ADDRESS;
        if (!contractAddr) {
            throw new Error(
                'Contract address not configured. Deploy via web UI or set FLASH_ARB_CONTRACT_ADDRESS in .env'
            );
        }
        this.contractAddress = contractAddr as Address;
    }

    // ============================================
    // READ METHODS
    // ============================================

    /**
     * Check if the contract is paused.
     */
    async isPaused(): Promise<boolean> {
        const result = await publicClient.readContract({
            address: this.contractAddress,
            abi: FLASH_ARB_ABI,
            functionName: 'paused',
        });
        return result as boolean;
    }

    /**
     * Check if the bot wallet is authorized as an executor.
     */
    async isBotAuthorized(): Promise<boolean> {
        if (!isBotWalletConfigured()) return false;

        const botAddress = getBotAddress();
        const result = await publicClient.readContract({
            address: this.contractAddress,
            abi: FLASH_ARB_ABI,
            functionName: 'isExecutor',
            args: [botAddress],
        });
        return result as boolean;
    }

    /**
     * Get the contract owner address.
     */
    async getOwner(): Promise<Address> {
        const result = await publicClient.readContract({
            address: this.contractAddress,
            abi: FLASH_ARB_ABI,
            functionName: 'OWNER',
        });
        return result as Address;
    }

    /**
     * Get token balance held by the contract.
     */
    async getContractBalance(token: Address): Promise<bigint> {
        const result = await publicClient.readContract({
            address: this.contractAddress,
            abi: FLASH_ARB_ABI,
            functionName: 'getBalance',
            args: [token],
        });
        return result as bigint;
    }

    // ============================================
    // EXECUTION METHOD
    // ============================================

    /**
     * Execute a flash loan arbitrage (autonomous - no user confirmation).
     */
    async executeFlashLoan(params: FlashLoanParams): Promise<ExecutionResult> {
        try {
            // Pre-flight check: Bot wallet configured
            if (!isBotWalletConfigured()) {
                return {
                    success: false,
                    txHash: '0x0' as `0x${string}`,
                    error: 'Bot wallet not configured (BOT_PRIVATE_KEY missing)',
                };
            }

            // Pre-flight check: Contract not paused
            const isPaused = await this.isPaused();
            if (isPaused) {
                return {
                    success: false,
                    txHash: '0x0' as `0x${string}`,
                    error: 'Contract is paused',
                };
            }

            // Pre-flight check: Bot is authorized executor
            const isAuthorized = await this.isBotAuthorized();
            if (!isAuthorized) {
                return {
                    success: false,
                    txHash: '0x0' as `0x${string}`,
                    error: 'Bot wallet is not an authorized executor',
                };
            }

            // Pre-flight check: Gas price acceptable
            const gasOk = await isGasPriceAcceptable();
            if (!gasOk) {
                return {
                    success: false,
                    txHash: '0x0' as `0x${string}`,
                    error: 'Gas price exceeds maximum',
                };
            }

            // Pre-flight check: Bot has gas
            const hasGas = await hasSufficientGas(0.001);
            if (!hasGas) {
                return {
                    success: false,
                    txHash: '0x0' as `0x${string}`,
                    error: 'Bot wallet has insufficient ETH for gas',
                };
            }

            // Encode the params for executeOperation callback
            const encodedParams = encodeAbiParameters(
                parseAbiParameters('address, uint24, uint256'),
                [params.targetToken, params.poolFee, params.minAmountOut]
            );

            const walletClient = getBotWalletClient();
            const botAddress = getBotAddress();

            // Estimate gas first
            let gasEstimate: bigint;
            try {
                gasEstimate = await publicClient.estimateContractGas({
                    address: this.contractAddress,
                    abi: FLASH_ARB_ABI,
                    functionName: 'requestFlashLoan',
                    args: [params.asset, params.amount, encodedParams],
                    account: botAddress,
                });
            } catch (estimateError: any) {
                // Gas estimation failed - likely the arb won't be profitable
                return {
                    success: false,
                    txHash: '0x0' as `0x${string}`,
                    error: `Gas estimation failed (arb may not be profitable): ${estimateError.message}`,
                };
            }

            // Add 30% buffer to gas estimate
            const gasLimit = (gasEstimate * BigInt(130)) / BigInt(100);

            // Execute the transaction (AUTONOMOUS - no user confirmation)
            const txHash = await walletClient.writeContract({
                chain: base,
                account: botAddress,
                address: this.contractAddress,
                abi: FLASH_ARB_ABI,
                functionName: 'requestFlashLoan',
                args: [params.asset, params.amount, encodedParams],
                gas: gasLimit,
            });

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({
                hash: txHash,
                confirmations: 1,
            });

            if (receipt.status === 'reverted') {
                return {
                    success: false,
                    txHash,
                    gasUsed: receipt.gasUsed,
                    error: 'Transaction reverted - arbitrage not profitable',
                };
            }

            return {
                success: true,
                txHash,
                gasUsed: receipt.gasUsed,
            };
        } catch (error: any) {
            return {
                success: false,
                txHash: '0x0' as `0x${string}`,
                error: error.message || 'Unknown error',
            };
        }
    }
}

// ============================================
// SINGLETON
// ============================================

let _flashArbClient: FlashArbClient | null = null;
let _lastContractAddress: string | null = null;

/**
 * Get the FlashArbClient singleton.
 * Recreates if contract address changed.
 * @throws Error if contract address is not configured
 */
export function getFlashArbClient(): FlashArbClient {
    const currentAddress = getContractAddress() || process.env.FLASH_ARB_CONTRACT_ADDRESS;

    // Recreate client if address changed
    if (_flashArbClient && _lastContractAddress !== currentAddress) {
        _flashArbClient = null;
    }

    if (!_flashArbClient) {
        _flashArbClient = new FlashArbClient();
        _lastContractAddress = currentAddress || null;
    }
    return _flashArbClient;
}

/**
 * Reset the client (call after contract address changes).
 */
export function resetFlashArbClient(): void {
    _flashArbClient = null;
    _lastContractAddress = null;
}

/**
 * Check if FlashArbClient can be initialized.
 */
export function isFlashArbConfigured(): boolean {
    return isContractConfigured() || !!process.env.FLASH_ARB_CONTRACT_ADDRESS;
}
