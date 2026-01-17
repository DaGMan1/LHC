'use client'

import { useIntelFeed } from '@/hooks/useIntelFeed'

export function MarketSignal() {
    const { latestPriority } = useIntelFeed()

    return (
        <div className="w-full p-6 bg-card rounded-[2rem] border border-card-border flex items-center justify-between group overflow-hidden relative">
            <div className={`absolute inset-0 transition-all duration-1000 ${latestPriority ? 'bg-primary/20 opacity-100' : 'bg-primary/5 opacity-0 group-hover:opacity-100'}`}></div>

            <div className="flex items-center gap-6 relative z-10 w-full">
                <div className={`p-3 rounded-xl border transition-all duration-500 ${latestPriority ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30' : 'bg-zinc-800 border-card-border text-primary'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" />
                    </svg>
                </div>
                <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">AI Market Signal</span>
                    <p className="text-sm font-bold text-zinc-100 italic transition-all duration-500">
                        {latestPriority ? `"${latestPriority.msg}"` : '"Analyzing cross-chain liquidity vectors and MEV opportunities on Base..."'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-8 relative z-10 hidden md:flex">
                <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Utilization</span>
                    <div className="flex items-center gap-3">
                        <div className="w-32 h-1.5 bg-background rounded-full overflow-hidden border border-card-border">
                            <div className="h-full bg-accent w-[66.9%] shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                        </div>
                        <span className="text-sm font-mono font-bold text-zinc-100">66.9%</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
