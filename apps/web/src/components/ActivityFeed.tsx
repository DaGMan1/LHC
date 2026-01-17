'use client'

import { useIntelContext } from './IntelProvider'

export function ActivityFeed() {
    const { messages } = useIntelContext()

    return (
        <div className="flex flex-col h-full bg-card rounded-[2rem] border border-card-border overflow-hidden">
            <div className="flex items-center gap-3 p-6 border-b border-card-border bg-background/50">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M17 3H21V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 3L13 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Live Intel</h3>
            </div>

            <div className="flex-1 p-6 overflow-y-auto font-mono text-[10px] space-y-4 scrollbar-hide">
                {messages.length > 0 ? messages.map((act, i) => (
                    <div key={i} className="flex gap-4 group animate-in fade-in slide-in-from-left-4 duration-500">
                        <span className="text-zinc-600 font-bold">{act.time}</span>
                        <span className={`font-black uppercase tracking-widest ${act.type === 'success' ? 'text-accent' :
                            act.type === 'warning' ? 'text-yellow-500' : 'text-zinc-400'
                            }`}>
                            {act.msg}
                        </span>
                    </div>
                )) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                        <span className="font-black uppercase tracking-widest text-center">Tuning into cross-chain signals...</span>
                    </div>
                )}
            </div>

            <div className="p-4 bg-background/50 border-t border-card-border flex items-center justify-between text-[10px] font-black uppercase tracking-widest px-6">
                <div className="flex items-center gap-2">
                    <span className="text-zinc-600">AERODRONE</span>
                    <span className="text-white">$2,658.876</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-zinc-600">UNISWAP V3</span>
                    <span className="text-white">$2,649.986</span>
                </div>
            </div>
        </div>
    )
}
