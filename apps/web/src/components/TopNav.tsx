'use client'

import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { formatUnits } from 'viem'
import { useState } from 'react'

export function TopNav() {
    const { address, isConnected } = useAccount()
    const { connectors, connect } = useConnect()
    const { disconnect } = useDisconnect()
    const { data: balance } = useBalance({ address })

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
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            <div className="flex items-center gap-6 text-xs font-bold">
                {isConnected && balance && (
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-zinc-500 uppercase tracking-widest text-[10px]">Balance</span>
                        <span className="text-white font-mono text-sm">
                            {balance ? Number(formatUnits(balance.value, balance.decimals)).toFixed(4) : '0.0000'} {balance?.symbol}
                        </span>
                    </div>
                )}

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
                    <div className="flex gap-2">
                        {connectors.map((connector) => (
                            <button
                                key={connector.uid}
                                onClick={() => connect({ connector })}
                                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-primary/20"
                            >
                                Connect Wallet
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </nav>
    )
}
