'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFlashArb } from '@/hooks/useFlashArb';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SystemStatus {
    liveMode: boolean;
    botWalletConfigured: boolean;
    botWalletAddress: string | null;
    contractConfigured: boolean;
    contractAddress: string | null;
}

export function SystemControl() {
    const {
        contractAddress,
        isConnected,
        isOwner,
        isPaused,
    } = useFlashArb();

    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Fetch system status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/config`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (err) {
            console.error('Failed to fetch status:', err);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Auto-sync contract address to API when it changes
    useEffect(() => {
        if (contractAddress && status && !status.contractAddress) {
            syncContractAddress(contractAddress);
        }
    }, [contractAddress, status]);

    const syncContractAddress = async (address: string) => {
        setSyncing(true);
        try {
            const res = await fetch(`${API_URL}/api/config/contract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
            });
            if (res.ok) {
                await fetchStatus();
            }
        } catch (err) {
            console.error('Failed to sync contract:', err);
        }
        setSyncing(false);
    };

    const handleGoLive = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/go-live`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractAddress: contractAddress || status?.contractAddress,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to go live');
            } else {
                await fetchStatus();
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        }

        setIsLoading(false);
    };

    const handleStopLive = async () => {
        setIsLoading(true);
        try {
            await fetch(`${API_URL}/api/config/live`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false }),
            });
            await fetchStatus();
        } catch (err) {
            console.error('Failed to stop:', err);
        }
        setIsLoading(false);
    };

    const isLive = status?.liveMode ?? false;
    const canGoLive = status?.botWalletConfigured && (contractAddress || status?.contractConfigured);

    return (
        <div className="bg-card rounded-[2rem] border border-card-border p-6 relative overflow-hidden">
            {/* Live indicator glow */}
            {isLive && (
                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent pointer-events-none" />
            )}

            <div className="relative z-10 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">System Control</h3>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-accent animate-pulse' : 'bg-zinc-600'}`} />
                        <span className={`text-xs font-black uppercase tracking-wider ${isLive ? 'text-accent' : 'text-zinc-500'}`}>
                            {isLive ? 'LIVE' : 'STANDBY'}
                        </span>
                    </div>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status?.botWalletConfigured ? 'bg-accent' : 'bg-red-500'}`} />
                        <span className="text-zinc-400">Bot Wallet</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${contractAddress || status?.contractConfigured ? 'bg-accent' : 'bg-yellow-500'}`} />
                        <span className="text-zinc-400">Contract</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent' : 'bg-zinc-600'}`} />
                        <span className="text-zinc-400">MetaMask</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isOwner ? 'bg-accent' : 'bg-zinc-600'}`} />
                        <span className="text-zinc-400">Owner</span>
                    </div>
                </div>

                {/* Bot Wallet Address */}
                {status?.botWalletAddress && (
                    <div className="p-3 bg-zinc-900/50 rounded-xl">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Bot Executor</p>
                        <p className="text-xs font-mono text-zinc-300 truncate">{status.botWalletAddress}</p>
                    </div>
                )}

                {/* Contract sync indicator */}
                {syncing && (
                    <p className="text-xs text-primary animate-pulse">Syncing contract address...</p>
                )}

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-xs text-red-400">{error}</p>
                    </div>
                )}

                {/* THE BIG BUTTON */}
                {isLive ? (
                    <button
                        onClick={handleStopLive}
                        disabled={isLoading}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white text-lg font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-600/30"
                    >
                        {isLoading ? 'STOPPING...' : 'STOP'}
                    </button>
                ) : (
                    <button
                        onClick={handleGoLive}
                        disabled={isLoading || !canGoLive}
                        className={`w-full py-4 text-white text-lg font-black uppercase tracking-wider rounded-xl transition-all ${
                            canGoLive
                                ? 'bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 shadow-lg shadow-accent/30'
                                : 'bg-zinc-700 cursor-not-allowed'
                        }`}
                    >
                        {isLoading ? 'ACTIVATING...' : 'GO LIVE'}
                    </button>
                )}

                {/* Help text */}
                {!canGoLive && !isLive && (
                    <p className="text-[10px] text-zinc-500 text-center">
                        {!status?.botWalletConfigured
                            ? 'Bot wallet not configured on server'
                            : 'Deploy contract first using the panel below'}
                    </p>
                )}
            </div>
        </div>
    );
}
