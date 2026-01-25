'use client'

import { useIntelContext } from './IntelProvider'

export function BotInterface() {
    const { botStates } = useIntelContext()

    const activeBots = botStates.filter(b => b.status === 'RUNNING')
    const totalPnL = botStates.reduce((acc, b) => acc + b.pnl, 0)
    const isSystemActive = activeBots.length > 0

    return (
        <div className="bg-card rounded-[2rem] border border-card-border overflow-hidden h-full flex flex-col group">
            <div className="p-6 border-b border-card-border bg-background/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Alpha-Core AI</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isSystemActive ? 'bg-accent animate-pulse' : 'bg-zinc-600'}`}></div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{isSystemActive ? 'ACTIVE' : 'IDLE'}</span>
                </div>
            </div>

            <div className="flex-1 p-8 flex flex-col items-center justify-center gap-8 text-center relative overflow-hidden">
                {/* Animated Orbs for AI processing */}
                {isSystemActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 bg-primary/20 rounded-full blur-[60px] animate-pulse"></div>
                        <div className="w-32 h-32 bg-accent/20 rounded-full blur-[40px] animate-pulse delay-700"></div>
                    </div>
                )}

                <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-500 relative z-10 ${isSystemActive ? 'border-accent shadow-[0_0_30px_rgba(16,185,129,0.3)] bg-accent/5' : 'border-card-border bg-zinc-800'}`}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={isSystemActive ? 'text-accent' : 'text-zinc-500'}>
                        <path d="M12 18.5C14.4853 18.5 16.5 16.4853 16.5 14C16.5 11.5147 14.4853 9.5 12 9.5C9.51472 9.5 7.5 11.5147 7.5 14C7.5 16.4853 9.51472 18.5 12 18.5Z" fill="currentColor" />
                        <path d="M12 2V5M12 22V19M22 12H19M2 12H5M19.07 19.07L16.95 16.95M4.93 4.93L7.05 7.05M19.07 4.93L16.95 7.05M4.93 19.07L7.05 16.95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Voice Assistant</span>
                    <p className="text-zinc-300 font-bold italic text-sm max-w-[200px]">
                        {isSystemActive
                            ? `"All systems operational. Vector yield: $${totalPnL.toFixed(2)}"`
                            : '"Awaiting hardware initialization... Systems steady."'}
                    </p>
                </div>
            </div>

            <div className="p-6 bg-background/50 border-t border-card-border mt-auto">
                <button className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] transition-all border flex items-center justify-center gap-2 ${isSystemActive ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-900 border-card-border text-zinc-600'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isSystemActive ? 'bg-accent' : 'bg-red-500'}`}></div>
                    {isSystemActive ? 'LISTENING' : 'MUTED'}
                </button>
            </div>
        </div>
    )
}
