'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFlashArb } from '@/hooks/useFlashArb';
import { formatEther } from 'viem';
import { BASE_ADDRESSES } from '@/contracts/FlashArbABI';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ActivationStep = 'idle' | 'deploying' | 'authorizing' | 'configuring' | 'activating';

interface ApiConfig {
    liveMode: boolean;
    botWalletConfigured: boolean;
    botWalletAddress: string | null;
    contractConfigured: boolean;
    contractAddress: string | null;
}

export function ActivationPanel() {
    const {
        contractAddress,
        isConnected,
        isDeploying,
        isPaused,
        isOwner,
        contractBalance,
        deploy,
        setExecutor,
        checkExecutor,
        withdrawProfits,
    } = useFlashArb();

    const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState<ActivationStep>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // Fetch API config (includes bot wallet address)
    const fetchConfig = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/config`);
            if (res.ok) {
                const data = await res.json();
                setApiConfig(data);
                setIsActive(data.liveMode);
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
        const interval = setInterval(fetchConfig, 5000);
        return () => clearInterval(interval);
    }, [fetchConfig]);

    // Check if bot is authorized (when we have both contract and bot address)
    const [botAuthorized, setBotAuthorized] = useState(false);
    useEffect(() => {
        if (contractAddress && apiConfig?.botWalletAddress) {
            checkExecutor(apiConfig.botWalletAddress as `0x${string}`)
                .then(setBotAuthorized);
        }
    }, [contractAddress, apiConfig?.botWalletAddress, checkExecutor]);

    // The main activation handler - does everything automatically
    const handleActivate = async () => {
        setError(null);

        try {
            let currentContractAddress = contractAddress;

            // Step 1: Deploy contract if needed
            if (!currentContractAddress) {
                setCurrentStep('deploying');
                const result = await deploy();
                if (!result.success) {
                    throw new Error(result.error || 'Failed to deploy contract');
                }
                // Wait a moment for state to update
                await new Promise(r => setTimeout(r, 1000));
                // Get the new contract address from localStorage
                currentContractAddress = localStorage.getItem('lhc1_flash_arb_contract') as `0x${string}`;
            }

            if (!currentContractAddress) {
                throw new Error('Contract deployment failed');
            }

            // Step 2: Authorize bot if needed
            const botAddr = apiConfig?.botWalletAddress;
            if (botAddr) {
                // Pass contract address explicitly since state may not have updated
                const isAuth = await checkExecutor(botAddr as `0x${string}`, currentContractAddress);
                if (!isAuth) {
                    setCurrentStep('authorizing');
                    const result = await setExecutor(botAddr as `0x${string}`, true, currentContractAddress);
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to authorize bot');
                    }
                    setBotAuthorized(true);
                }
            }

            // Step 3: Sync contract address to API
            setCurrentStep('configuring');
            const configRes = await fetch(`${API_URL}/api/config/contract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: currentContractAddress }),
            });
            if (!configRes.ok) {
                const data = await configRes.json();
                throw new Error(data.error || 'Failed to configure contract');
            }

            // Step 4: Go live!
            setCurrentStep('activating');
            const liveRes = await fetch(`${API_URL}/api/go-live`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contractAddress: currentContractAddress }),
            });

            const liveData = await liveRes.json();
            if (!liveRes.ok) {
                throw new Error(liveData.error || 'Failed to go live');
            }

            setIsActive(true);
            await fetchConfig();
        } catch (err: any) {
            setError(err.message || 'Activation failed');
        } finally {
            setCurrentStep('idle');
        }
    };

    // Deactivate
    const handleDeactivate = async () => {
        try {
            const res = await fetch(`${API_URL}/api/config/live`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false }),
            });
            if (res.ok) {
                setIsActive(false);
                await fetchConfig();
            }
        } catch (err) {
            console.error('Failed to deactivate:', err);
        }
    };

    // Withdraw profits
    const handleWithdraw = async () => {
        setIsWithdrawing(true);
        try {
            const result = await withdrawProfits(BASE_ADDRESSES.WETH);
            if (!result.success) {
                setError(result.error || 'Withdrawal failed');
            }
        } catch (err: any) {
            setError(err.message);
        }
        setIsWithdrawing(false);
    };

    // Determine button state
    const isProcessing = currentStep !== 'idle' || isDeploying;
    const canActivate = isConnected && apiConfig?.botWalletConfigured;

    // Get step text for progress display
    const getStepText = () => {
        switch (currentStep) {
            case 'deploying': return 'Deploying contract... (confirm in MetaMask)';
            case 'authorizing': return 'Authorizing bot... (confirm in MetaMask)';
            case 'configuring': return 'Configuring system...';
            case 'activating': return 'Activating bot...';
            default: return '';
        }
    };

    return (
        <div className="bg-card rounded-[2rem] border border-card-border p-6 relative overflow-hidden">
            {/* Active state glow */}
            {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent pointer-events-none" />
            )}

            <div className="relative z-10 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Flash Loan Arbitrage</h3>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-accent animate-pulse' : 'bg-zinc-600'}`} />
                        <span className={`text-xs font-black uppercase tracking-wider ${isActive ? 'text-accent' : 'text-zinc-500'}`}>
                            {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                    </div>
                </div>

                {/* Progress Steps (during activation) */}
                {isProcessing && (
                    <div className="space-y-2 p-4 bg-zinc-900/50 rounded-xl">
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isConnected ? 'bg-accent text-white' : 'bg-zinc-700 text-zinc-500'}`}>
                                {isConnected ? '✓' : '○'}
                            </div>
                            <span className="text-xs text-zinc-400">Wallet connected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                currentStep === 'deploying' ? 'bg-primary animate-pulse text-white' :
                                contractAddress ? 'bg-accent text-white' : 'bg-zinc-700 text-zinc-500'
                            }`}>
                                {contractAddress ? '✓' : currentStep === 'deploying' ? '...' : '○'}
                            </div>
                            <span className="text-xs text-zinc-400">Contract deployed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                currentStep === 'authorizing' ? 'bg-primary animate-pulse text-white' :
                                botAuthorized ? 'bg-accent text-white' : 'bg-zinc-700 text-zinc-500'
                            }`}>
                                {botAuthorized ? '✓' : currentStep === 'authorizing' ? '...' : '○'}
                            </div>
                            <span className="text-xs text-zinc-400">Bot authorized</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                                currentStep === 'activating' || currentStep === 'configuring' ? 'bg-primary animate-pulse text-white' :
                                isActive ? 'bg-accent text-white' : 'bg-zinc-700 text-zinc-500'
                            }`}>
                                {isActive ? '✓' : (currentStep === 'activating' || currentStep === 'configuring') ? '...' : '○'}
                            </div>
                            <span className="text-xs text-zinc-400">Bot active</span>
                        </div>
                        {getStepText() && (
                            <p className="text-xs text-primary mt-2 animate-pulse">{getStepText()}</p>
                        )}
                    </div>
                )}

                {/* Contract info (when active) */}
                {isActive && contractAddress && !isProcessing && (
                    <div className="p-4 bg-zinc-900/50 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-500 uppercase">Contract</span>
                            <span className="text-xs font-mono text-zinc-300">{contractAddress.slice(0, 8)}...{contractAddress.slice(-6)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-500 uppercase">Profits (WETH)</span>
                            <span className="text-xs font-mono text-accent">{Number(formatEther(contractBalance)).toFixed(6)}</span>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-xs text-red-400">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="text-[10px] text-zinc-500 hover:text-white mt-1 underline"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* THE BIG BUTTON */}
                {!isConnected ? (
                    <button
                        disabled
                        className="w-full py-4 bg-zinc-700 text-zinc-500 text-lg font-black uppercase tracking-wider rounded-xl cursor-not-allowed"
                    >
                        Connect Wallet First
                    </button>
                ) : isActive ? (
                    <div className="space-y-2">
                        <button
                            onClick={handleDeactivate}
                            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white text-lg font-black uppercase tracking-wider rounded-xl transition-all"
                        >
                            Deactivate
                        </button>
                        {contractBalance > BigInt(0) && (
                            <button
                                onClick={handleWithdraw}
                                disabled={isWithdrawing}
                                className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-all"
                            >
                                {isWithdrawing ? 'Withdrawing...' : 'Withdraw Profits'}
                            </button>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={handleActivate}
                        disabled={!canActivate || isProcessing}
                        className={`w-full py-4 text-white text-lg font-black uppercase tracking-wider rounded-xl transition-all ${
                            canActivate && !isProcessing
                                ? 'bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 shadow-lg shadow-accent/30 cursor-pointer'
                                : 'bg-zinc-700 cursor-not-allowed'
                        }`}
                    >
                        {isProcessing ? 'Processing...' : 'Activate Trading Bot'}
                    </button>
                )}

                {/* Helper text */}
                {!isActive && !isProcessing && isConnected && (
                    <p className="text-[10px] text-zinc-500 text-center">
                        {!apiConfig?.botWalletConfigured
                            ? 'Server not ready - bot wallet not configured'
                            : !contractAddress
                                ? 'First time? You\'ll need to confirm 2 transactions in MetaMask'
                                : 'Click to start autonomous trading'
                        }
                    </p>
                )}
            </div>
        </div>
    );
}
