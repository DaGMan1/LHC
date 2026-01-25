'use client';

import { useState } from 'react';
import { useFlashArb, ArbitrageOpportunity } from '@/hooks/useFlashArb';
import { useIntelContext } from '@/components/IntelProvider';
import { formatEther, parseEther } from 'viem';
import { BASE_ADDRESSES } from '@/contracts/FlashArbABI';

export function TradingPanel() {
    const {
        contractAddress,
        isConnected,
        isExecuting,
        isPaused,
        isOwner,
        executeArbitrage,
    } = useFlashArb();

    const { messages } = useIntelContext();

    const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
    const [autoTrade, setAutoTrade] = useState(false);

    // Extract arbitrage opportunities from intel messages
    const opportunities = messages
        .filter(m => m.msg.includes('ARB DETECTED'))
        .slice(0, 5)
        .map((m, i) => {
            // Parse opportunity from message content
            // Expected format: "[FLASH-LOAN] ARB DETECTED: WETH/USDC spread 0.45% | Est. profit: $12.50"
            const spreadMatch = m.msg.match(/spread\s+([\d.]+)%/);
            const profitMatch = m.msg.match(/profit:\s*\$([\d.]+)/);
            const spread = spreadMatch ? parseFloat(spreadMatch[1]) : 0;
            const profit = profitMatch ? parseFloat(profitMatch[1]) : 0;

            return {
                id: `opp-${i}-${Date.now()}`,
                asset: BASE_ADDRESSES.WETH,
                assetSymbol: 'WETH',
                targetToken: BASE_ADDRESSES.USDC,
                targetSymbol: 'USDC',
                poolFee: 500, // 0.05% fee tier
                amount: parseEther('1'), // 1 ETH flash loan
                expectedProfit: BigInt(Math.floor(profit * 1e6)), // In USDC (6 decimals)
                spreadPercent: spread,
                timestamp: Date.now(),
                raw: m.msg,
            } as ArbitrageOpportunity & { raw: string };
        });

    const handleExecute = async (opp: ArbitrageOpportunity) => {
        setLastResult(null);
        const result = await executeArbitrage(opp);

        if (result.success) {
            setLastResult({
                success: true,
                message: `Trade executed! TX: ${result.txHash?.slice(0, 10)}...`
            });
        } else {
            setLastResult({
                success: false,
                message: result.error || 'Execution failed'
            });
        }
    };

    // Not ready state
    if (!isConnected) {
        return (
            <div className="bg-card rounded-2xl border border-card-border p-6">
                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">Live Trading</h3>
                <p className="text-zinc-500 text-xs">Connect your wallet to start trading.</p>
            </div>
        );
    }

    if (!contractAddress) {
        return (
            <div className="bg-card rounded-2xl border border-card-border p-6">
                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">Live Trading</h3>
                <p className="text-zinc-500 text-xs">Deploy your FlashArb contract first to enable trading.</p>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="bg-card rounded-2xl border border-card-border p-6">
                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">Live Trading</h3>
                <p className="text-red-400 text-xs">You are not the owner of the connected contract.</p>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-2xl border border-card-border p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Live Trading</h3>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-accent animate-pulse'}`}></div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">
                        {isPaused ? 'Paused' : 'Ready'}
                    </span>
                </div>
            </div>

            {/* Status */}
            {lastResult && (
                <div className={`text-xs p-3 rounded-lg ${lastResult.success ? 'bg-accent/20 text-accent' : 'bg-red-500/20 text-red-400'
                    }`}>
                    {lastResult.message}
                </div>
            )}

            {isPaused && (
                <div className="text-xs p-3 rounded-lg bg-yellow-500/20 text-yellow-400">
                    Contract is paused. Unpause to execute trades.
                </div>
            )}

            {/* Auto-trade toggle */}
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl">
                <div>
                    <p className="text-xs font-bold text-white">Auto-Execute</p>
                    <p className="text-[10px] text-zinc-500">Automatically execute profitable opportunities</p>
                </div>
                <button
                    onClick={() => setAutoTrade(!autoTrade)}
                    disabled={isPaused}
                    className={`relative w-12 h-6 rounded-full transition-colors ${autoTrade && !isPaused ? 'bg-accent' : 'bg-zinc-700'
                        } ${isPaused ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoTrade && !isPaused ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                </button>
            </div>

            {/* Opportunities */}
            <div className="space-y-2">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Opportunities</p>

                {opportunities.length === 0 ? (
                    <div className="p-4 border border-dashed border-card-border rounded-xl text-center">
                        <p className="text-xs text-zinc-600">Scanning for arbitrage opportunities...</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {opportunities.map((opp) => (
                            <div
                                key={opp.id}
                                className="p-3 bg-zinc-900/50 border border-card-border rounded-xl"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-white">
                                            {opp.assetSymbol}/{opp.targetSymbol}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${opp.spreadPercent >= 0.3 ? 'bg-accent/20 text-accent' : 'bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {opp.spreadPercent.toFixed(2)}% spread
                                        </span>
                                    </div>
                                    <span className="text-xs text-accent font-mono">
                                        +${(Number(opp.expectedProfit) / 1e6).toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-500">
                                        Flash: {formatEther(opp.amount)} ETH
                                    </span>
                                    <button
                                        onClick={() => handleExecute(opp)}
                                        disabled={isExecuting || isPaused}
                                        className="px-3 py-1 bg-primary hover:bg-primary/80 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-[10px] font-bold uppercase rounded-lg transition-colors"
                                    >
                                        {isExecuting ? 'Executing...' : 'Execute'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Gas estimate */}
            <div className="text-[10px] text-zinc-600 text-center">
                Est. gas per trade: ~0.001 ETH ($2-5)
            </div>
        </div>
    );
}
