'use client'

import { useIntelContext } from './IntelProvider'

interface StrategyProps {
    id: string
    title: string
    description: string
    icon: React.ReactNode
}

export function StrategyCard({ id, title, description, icon }: StrategyProps) {
    const { botStates } = useIntelContext()
    const bot = botStates.find(b => b.id === id)

    const isRunning = bot?.status === 'RUNNING'
    const pnl = bot?.pnl || 0
    const allocated = bot?.allocated || 0

    const toggleBot = async () => {
        const action = isRunning ? 'stop' : 'start'
        try {
            await fetch(`http://localhost:3001/api/bots/${id}/${action}`, { method: 'POST' })
        } catch (err) {
            console.error(`Failed to ${action} bot:`, err)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-8 bg-card rounded-3xl border border-card-border hover:border-primary/30 transition-all group overflow-hidden relative">
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 transition-all ${isRunning ? 'bg-accent/20' : 'bg-primary/5 group-hover:bg-primary/10'}`}></div>

            <div className="flex items-start justify-between">
                <div className={`p-4 rounded-2xl border transition-all ${isRunning ? 'bg-accent/10 border-accent/30 text-accent shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-background border-card-border text-primary group-hover:bg-primary/5'}`}>
                    {icon}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-card-border">
                    <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-accent animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'}`}></div>
                    <span className="text-[10px] font-black text-zinc-400 tracking-widest">{bot?.status || 'IDLE'}</span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight italic leading-tight">
                    {title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed font-medium">
                    {description}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Session PNL</span>
                    <span className={`text-lg font-mono font-bold ${pnl > 0 ? 'text-accent' : pnl < 0 ? 'text-red-500' : 'text-zinc-300'}`}>
                        ${pnl.toFixed(2)}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Allocated</span>
                    <span className="text-lg font-mono font-bold text-zinc-300">
                        ${allocated.toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-background/50 rounded-2xl border border-card-border/50 min-h-[100px]">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <div className={`w-1 h-1 rounded-full ${isRunning ? 'bg-accent' : 'bg-zinc-700'}`}></div>
                    Live Activity
                </span>
                {bot?.logs && bot.logs.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                        {bot.logs.map((log, i) => (
                            <p key={i} className="text-[10px] font-mono text-zinc-400 group-hover:text-zinc-300 transition-colors leading-tight">
                                {log}
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] font-mono text-zinc-700 italic">No activity detected...</p>
                )}
            </div>

            <button
                onClick={toggleBot}
                className={`w-full py-4 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl border transition-all ${isRunning
                    ? 'bg-zinc-800 border-zinc-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/30'
                    : 'bg-background border-card-border text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
            >
                {isRunning ? 'DEACTIVATE STRATEGY' : 'ACTIVATE STRATEGY'}
            </button>
        </div>
    )
}

