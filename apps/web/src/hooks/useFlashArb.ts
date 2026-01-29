'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { encodeAbiParameters, parseAbiParameters, formatEther, parseEther } from 'viem';
import { base } from 'wagmi/chains';
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
    const { address, isConnected, chainId } = useAccount();
    // Get public client for Base (for reading contract state)
    const publicClient = usePublicClient({ chainId: base.id });
    // Get wallet client WITHOUT chainId - we'll switch chains before transactions
    // If we specify chainId: base.id, it returns undefined when wallet is on different chain
    const { data: walletClient } = useWalletClient();
    const { switchChainAsync } = useSwitchChain();

    const [contractAddress, setContractAddress] = useState<`0x${string}` | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [contractBalance, setContractBalance] = useState<bigint>(BigInt(0));

    // Load contract address from local storage and recover pending deploys
    useEffect(() => {
        if (typeof window === 'undefined' || !publicClient) return;

        let isMounted = true;

        const loadContract = async () => {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                // Verify the saved contract is compatible (has setExecutor function)
                try {
                    const code = await publicClient.getCode({ address: saved as `0x${string}` });
                    if (!code || code === '0x') {
                        // Contract doesn't exist on-chain (wrong network or not deployed)
                        console.warn('[FlashArb] Saved contract has no code on-chain, clearing');
                        localStorage.removeItem(STORAGE_KEY);
                        return;
                    }
                    // Try calling isExecutor to verify ABI compatibility
                    await publicClient.readContract({
                        address: saved as `0x${string}`,
                        abi: FlashArbContract.abi,
                        functionName: 'isExecutor',
                        args: ['0x0000000000000000000000000000000000000001'],
                    });
                    // Contract is valid and compatible
                    if (isMounted) setContractAddress(saved as `0x${string}`);
                } catch (err: any) {
                    console.warn('[FlashArb] Saved contract is incompatible (missing setExecutor), clearing:', err.message);
                    localStorage.removeItem(STORAGE_KEY);
                    // Don't set contractAddress - user will need to redeploy
                }
                return;
            }

            // Check for pending deploy transaction
            const pendingTx = localStorage.getItem('lhc1_pending_deploy_tx');
            if (pendingTx) {
                console.log('[FlashArb] Found pending deploy tx, trying to recover:', pendingTx);
                try {
                    const receipt = await publicClient.getTransactionReceipt({
                        hash: pendingTx as `0x${string}`
                    });
                    if (receipt && receipt.contractAddress && isMounted) {
                        console.log('[FlashArb] Recovered contract address:', receipt.contractAddress);
                        localStorage.setItem(STORAGE_KEY, receipt.contractAddress);
                        localStorage.removeItem('lhc1_pending_deploy_tx');
                        setContractAddress(receipt.contractAddress);
                        setIsOwner(true);
                    }
                } catch (err: any) {
                    console.log('[FlashArb] Could not recover pending tx:', err.message);
                }
            }
        };

        loadContract();

        return () => {
            isMounted = false;
        };
    }, [publicClient]);

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
            // Ensure we're on Base chain before deploying
            if (chainId !== base.id) {
                await switchChainAsync({ chainId: base.id });
            }

            // Deploy with constructor args: Aave Pool Provider and Uniswap Router
            const hash = await walletClient.deployContract({
                abi: FlashArbContract.abi,
                bytecode: FlashArbContract.bytecode as `0x${string}`,
                args: [BASE_ADDRESSES.AAVE_POOL_PROVIDER, BASE_ADDRESSES.UNISWAP_ROUTER],
                chain: base,
            });

            console.log('[FlashArb] Deploy tx submitted:', hash);

            // Wait for deployment with timeout and retries
            let receipt;
            let retries = 3;
            while (retries > 0) {
                try {
                    receipt = await publicClient.waitForTransactionReceipt({
                        hash,
                        timeout: 60_000, // 60 seconds
                    });
                    break; // Success
                } catch (err: any) {
                    retries--;
                    console.log(`[FlashArb] Receipt fetch failed, ${retries} retries left:`, err.message);
                    if (retries === 0) {
                        // Save tx hash for recovery
                        localStorage.setItem('lhc1_pending_deploy_tx', hash);
                        return {
                            success: false,
                            txHash: hash,
                            error: `Tx sent but receipt failed. Hash: ${hash.slice(0, 10)}... Check BaseScan and refresh.`
                        };
                    }
                    await new Promise(r => setTimeout(r, 3000)); // Wait 3s before retry
                }
            }

            if (!receipt || receipt.status === 'reverted') {
                return { success: false, error: 'Deployment reverted' };
            }

            const deployed = receipt.contractAddress;
            if (!deployed) {
                return { success: false, error: 'No contract address in receipt' };
            }

            console.log('[FlashArb] Contract deployed at:', deployed);

            // Save to local storage
            localStorage.setItem(STORAGE_KEY, deployed);
            localStorage.removeItem('lhc1_pending_deploy_tx'); // Clear pending
            setContractAddress(deployed);
            setIsOwner(true);

            return { success: true, txHash: hash };
        } catch (err: any) {
            return { success: false, error: err.message || 'Deployment failed' };
        } finally {
            setIsDeploying(false);
        }
    }, [walletClient, publicClient, address, chainId, switchChainAsync]);

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
            // Ensure we're on Base chain
            if (chainId !== base.id) {
                await switchChainAsync({ chainId: base.id });
            }

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
                chain: base,
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
    }, [walletClient, publicClient, contractAddress, isPaused, isOwner, chainId, switchChainAsync]);

    // Withdraw profits
    const withdrawProfits = useCallback(async (
        token: `0x${string}`
    ): Promise<ExecutionResult> => {
        if (!walletClient || !publicClient || !contractAddress) {
            return { success: false, error: 'Contract not deployed or wallet not connected' };
        }

        try {
            // Ensure we're on Base chain
            if (chainId !== base.id) {
                await switchChainAsync({ chainId: base.id });
            }

            const hash = await walletClient.writeContract({
                address: contractAddress,
                abi: FlashArbContract.abi,
                functionName: 'withdraw',
                args: [token],
                chain: base,
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
    }, [walletClient, publicClient, contractAddress, chainId, switchChainAsync]);

    // Toggle pause state
    const togglePause = useCallback(async (): Promise<ExecutionResult> => {
        if (!walletClient || !publicClient || !contractAddress) {
            return { success: false, error: 'Contract not deployed or wallet not connected' };
        }

        try {
            // Ensure we're on Base chain
            if (chainId !== base.id) {
                await switchChainAsync({ chainId: base.id });
            }

            const hash = await walletClient.writeContract({
                address: contractAddress,
                abi: FlashArbContract.abi,
                functionName: 'setPaused',
                args: [!isPaused],
                chain: base,
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
    }, [walletClient, publicClient, contractAddress, isPaused, chainId, switchChainAsync]);

    // Add or remove an executor (bot wallet that can trigger trades but NOT withdraw)
    // Optional targetContract param allows passing address directly after deployment
    const setExecutor = useCallback(async (
        executorAddress: `0x${string}`,
        allowed: boolean,
        targetContract?: `0x${string}`
    ): Promise<ExecutionResult> => {
        const contract = targetContract || contractAddress;
        if (!walletClient || !publicClient || !contract) {
            return { success: false, error: 'Contract not deployed or wallet not connected' };
        }

        // Skip owner check if we just deployed (state may not have updated)
        // The contract will enforce ownership anyway

        try {
            // Ensure we're on Base chain
            if (chainId !== base.id) {
                await switchChainAsync({ chainId: base.id });
            }

            const hash = await walletClient.writeContract({
                address: contract,
                abi: FlashArbContract.abi,
                functionName: 'setExecutor',
                args: [executorAddress, allowed],
                chain: base,
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
    }, [walletClient, publicClient, contractAddress, chainId, switchChainAsync]);

    // Check if an address is an executor
    // Optional targetContract param allows passing address directly after deployment
    const checkExecutor = useCallback(async (
        executorAddress: `0x${string}`,
        targetContract?: `0x${string}`
    ): Promise<boolean> => {
        const contract = targetContract || contractAddress;
        if (!publicClient || !contract) return false;

        try {
            const result = await publicClient.readContract({
                address: contract,
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
