'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { encodeAbiParameters, parseAbiParameters, formatEther, parseEther } from 'viem';
import FlashArbContract from '../contracts/FlashArbBytecode.json';
import { BASE_ADDRESSES } from '../contracts/FlashArbABI';

const STORAGE_KEY = 'lhc1_flash_arb_contract';

export interface ArbitrageOpportunity {
    id: string;
    asset: `0x${string}`;
    assetSymbol: string;
    targetToken: `0x${string}`;
    targetSymbol: string;
    poolFee: number;
    amount: bigint;
    expectedProfit: bigint;
    spreadPercent: number;
    timestamp: number;
}

export interface ExecutionResult {
    success: boolean;
    txHash?: `0x${string}`;
    error?: string;
    profit?: bigint;
}

export function useFlashArb() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const [contractAddress, setContractAddress] = useState<`0x${string}` | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [contractBalance, setContractBalance] = useState<bigint>(BigInt(0));

    // Load contract address from local storage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setContractAddress(saved as `0x${string}`);
            }
        }
    }, []);

    // Check contract state when address changes
    useEffect(() => {
        if (!contractAddress || !publicClient || !address) return;

        const checkContract = async () => {
            try {
                // Check if paused
                const paused = await publicClient.readContract({
                    address: contractAddress,
                    abi: FlashArbContract.abi,
                    functionName: 'paused',
                }) as boolean;
                setIsPaused(paused);

                // Check ownership
                const owner = await publicClient.readContract({
                    address: contractAddress,
                    abi: FlashArbContract.abi,
                    functionName: 'OWNER',
                }) as `0x${string}`;
                setIsOwner(owner.toLowerCase() === address.toLowerCase());

                // Check WETH balance
                const balance = await publicClient.readContract({
                    address: contractAddress,
                    abi: FlashArbContract.abi,
                    functionName: 'getBalance',
                    args: [BASE_ADDRESSES.WETH],
                }) as bigint;
                setContractBalance(balance);
            } catch (err) {
                console.error('Error checking contract state:', err);
            }
        };

        checkContract();
        const interval = setInterval(checkContract, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [contractAddress, publicClient, address]);

    // Deploy the FlashArb contract
    const deploy = useCallback(async (): Promise<ExecutionResult> => {
        if (!walletClient || !publicClient || !address) {
            return { success: false, error: 'Wallet not connected' };
        }

        setIsDeploying(true);
        try {
            // Deploy with constructor args: Aave Pool Provider and Uniswap Router
            const hash = await walletClient.deployContract({
                abi: FlashArbContract.abi,
                bytecode: FlashArbContract.bytecode as `0x${string}`,
                args: [BASE_ADDRESSES.AAVE_POOL_PROVIDER, BASE_ADDRESSES.UNISWAP_ROUTER],
            });

            // Wait for deployment
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'reverted') {
                return { success: false, error: 'Deployment reverted' };
            }

            const deployed = receipt.contractAddress;
            if (!deployed) {
                return { success: false, error: 'No contract address in receipt' };
            }

            // Save to local storage
            localStorage.setItem(STORAGE_KEY, deployed);
            setContractAddress(deployed);
            setIsOwner(true);

            return { success: true, txHash: hash };
        } catch (err: any) {
            return { success: false, error: err.message || 'Deployment failed' };
        } finally {
            setIsDeploying(false);
        }
    }, [walletClient, publicClient, address]);

    // Execute a flash loan arbitrage
    const executeArbitrage = useCallback(async (
        opportunity: ArbitrageOpportunity
    ): Promise<ExecutionResult> => {
        if (!walletClient || !publicClient || !contractAddress) {
            return { success: false, error: 'Contract not deployed or wallet not connected' };
        }

        if (isPaused) {
            return { success: false, error: 'Contract is paused' };
        }

        if (!isOwner) {
            return { success: false, error: 'You are not the contract owner' };
        }

        setIsExecuting(true);
        try {
            // Encode params for the flash loan callback
            // minAmountOut = amount - 1% slippage
            const minAmountOut = (opportunity.amount * BigInt(99)) / BigInt(100);

            const encodedParams = encodeAbiParameters(
                parseAbiParameters('address, uint24, uint256'),
                [opportunity.targetToken, opportunity.poolFee, minAmountOut]
            );

            // Execute the flash loan
            const hash = await walletClient.writeContract({
                address: contractAddress,
                abi: FlashArbContract.abi,
                functionName: 'requestFlashLoan',
                args: [opportunity.asset, opportunity.amount, encodedParams],
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'reverted') {
                return { success: false, txHash: hash, error: 'Transaction reverted - arbitrage not profitable' };
            }

            return { success: true, txHash: hash };
        } catch (err: any) {
            return { success: false, error: err.message || 'Execution failed' };
        } finally {
            setIsExecuting(false);
        }
    }, [walletClient, publicClient, contractAddress, isPaused, isOwner]);

    // Withdraw profits
    const withdrawProfits = useCallback(async (
        token: `0x${string}`
    ): Promise<ExecutionResult> => {
        if (!walletClient || !publicClient || !contractAddress) {
            return { success: false, error: 'Contract not deployed or wallet not connected' };
        }

        try {
            const hash = await walletClient.writeContract({
                address: contractAddress,
                abi: FlashArbContract.abi,
                functionName: 'withdraw',
                args: [token],
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            return {
                success: receipt.status === 'success',
                txHash: hash,
                error: receipt.status === 'reverted' ? 'Withdrawal reverted' : undefined
            };
        } catch (err: any) {
            return { success: false, error: err.message || 'Withdrawal failed' };
        }
    }, [walletClient, publicClient, contractAddress]);

    // Toggle pause state
    const togglePause = useCallback(async (): Promise<ExecutionResult> => {
        if (!walletClient || !publicClient || !contractAddress) {
            return { success: false, error: 'Contract not deployed or wallet not connected' };
        }

        try {
            const hash = await walletClient.writeContract({
                address: contractAddress,
                abi: FlashArbContract.abi,
                functionName: 'setPaused',
                args: [!isPaused],
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                setIsPaused(!isPaused);
            }

            return {
                success: receipt.status === 'success',
                txHash: hash
            };
        } catch (err: any) {
            return { success: false, error: err.message || 'Toggle pause failed' };
        }
    }, [walletClient, publicClient, contractAddress, isPaused]);

    // Add or remove an executor (bot wallet that can trigger trades but NOT withdraw)
    const setExecutor = useCallback(async (
        executorAddress: `0x${string}`,
        allowed: boolean
    ): Promise<ExecutionResult> => {
        if (!walletClient || !publicClient || !contractAddress) {
            return { success: false, error: 'Contract not deployed or wallet not connected' };
        }

        if (!isOwner) {
            return { success: false, error: 'Only the owner can set executors' };
        }

        try {
            const hash = await walletClient.writeContract({
                address: contractAddress,
                abi: FlashArbContract.abi,
                functionName: 'setExecutor',
                args: [executorAddress, allowed],
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            return {
                success: receipt.status === 'success',
                txHash: hash,
                error: receipt.status === 'reverted' ? 'Transaction reverted' : undefined
            };
        } catch (err: any) {
            return { success: false, error: err.message || 'Set executor failed' };
        }
    }, [walletClient, publicClient, contractAddress, isOwner]);

    // Check if an address is an executor
    const checkExecutor = useCallback(async (
        executorAddress: `0x${string}`
    ): Promise<boolean> => {
        if (!publicClient || !contractAddress) return false;

        try {
            const result = await publicClient.readContract({
                address: contractAddress,
                abi: FlashArbContract.abi,
                functionName: 'isExecutor',
                args: [executorAddress],
            });
            return result as boolean;
        } catch {
            return false;
        }
    }, [publicClient, contractAddress]);

    // Set contract address manually (for existing deployments)
    const setExistingContract = useCallback((address: `0x${string}`) => {
        localStorage.setItem(STORAGE_KEY, address);
        setContractAddress(address);
    }, []);

    // Clear contract address
    const clearContract = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setContractAddress(null);
        setIsOwner(false);
        setIsPaused(false);
    }, []);

    return {
        // State
        contractAddress,
        isConnected,
        isDeploying,
        isExecuting,
        isPaused,
        isOwner,
        contractBalance,
        walletAddress: address,

        // Actions
        deploy,
        executeArbitrage,
        withdrawProfits,
        togglePause,
        setExecutor,
        checkExecutor,
        setExistingContract,
        clearContract,
    };
}
