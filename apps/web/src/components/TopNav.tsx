'use client'

import { useAccount, useConnect, useDisconnect, useBalance, useChainId } from 'wagmi'
import { formatUnits } from 'viem'
import { useState, useEffect } from 'react'
import { base } from 'wagmi/chains'

export function TopNav() {
    const [mounted, setMounted] = useState(false)
    const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false)
    const { address, isConnected } = useAccount()
    const { connectors, connect, error, isPending, reset } = useConnect()
    const { disconnect } = useDisconnect()
    const chainId = useChainId()
    // Fetch balance from Base chain (where the bot operates)
    const { data: balance, refetch: refetchBalance } = useBalance({
        address,
        chainId: base.id,
    })

    useEffect(() => {
        setMounted(true)
        // Clear any stale errors on mount
        reset()
    }, [reset])

    // Refresh balance periodically
    useEffect(() => {
        if (!address) return
        const interval = setInterval(() => {
            refetchBalance()
        }, 15000) // Refresh every 15 seconds
        return () => clearInterval(interval)
    }, [address, refetchBalance])

    const handleConnect = () => {
        setHasAttemptedConnect(true)
        // Use the first available connector (injected wallet)
        const connector = connectors[0]
        if (connector) {
            connect({ connector })
        }
    }

    // Prevent hydration mismatch by only rendering wallet-dependent UI on the client
    if (!mounted) return (
        <nav className="flex items-center justify-between px-8 py-4 bg-background border-b border-card-border sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center font-bold text-zinc-500">α</div>
                    <h1 className="text-xl font-black tracking-tighter text-zinc-500 uppercase italic">Alpha Core</h1>
                </div>
            </div>
        </nav>
    )

    return (
        <nav className="flex items-center justify-between px-8 py-4 bg-background border-b border-card-border sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20">
                        α
                    </div>
                    <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">
                        Alpha Core
                    </h1>
                </div>
                <div className="h-4 w-[1px] bg-card-border hidden sm:block"></div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-card rounded-full border border-card-border text-xs font-bold text-zinc-400">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    BASE
                </div>
            </div>

            <div className="flex items-center gap-6 text-xs font-bold">
                {isConnected && balance && (
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Balance</span>
                        <span className="text-white font-mono text-sm">
                            {Number(formatUnits(balance.value, balance.decimals)).toFixed(4)} {balance.symbol}
                        </span>
                    </div>
                )}

                <div className="flex flex-col items-end gap-1">
                    {isConnected ? (
                        <div className="flex items-center gap-3">
                            <div className="hidden lg:flex flex-col items-end">
                                <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Connected Wallet</span>
                                <span className="text-zinc-300 font-mono text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                            </div>
                            <button
                                onClick={() => disconnect()}
                                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl border border-white/5 transition-all text-sm font-bold shadow-xl"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleConnect}
                                disabled={isPending || connectors.length === 0}
                                className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-primary/20 cursor-pointer"
                            >
                                {isPending ? 'Connecting...' : connectors.length > 0 ? 'Connect Wallet' : 'No Wallet'}
                            </button>
                        </div>
                    )}
                    {error && hasAttemptedConnect && (
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] text-red-500 uppercase tracking-widest font-black max-w-[300px] text-right">
                                {error.message.includes('rejected')
                                    ? 'Rejected - Try Again'
                                    : error.message.includes('already pending')
                                        ? 'Check MetaMask Popup'
                                        : 'Check MetaMask & Retry'}
                            </span>
                            <button
                                onClick={() => { reset(); setHasAttemptedConnect(false); }}
                                className="text-[8px] text-zinc-500 hover:text-white underline"
                            >
                                Clear Error
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    )
}
