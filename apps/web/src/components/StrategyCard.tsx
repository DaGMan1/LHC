'use client'

import { useState } from 'react'

interface StrategyProps {
    title: string
    description: string
    status: 'IDLE' | 'ACTIVE' | 'ERROR'
    pnl: string
    allocated: string
    icon: React.ReactNode
}

export function StrategyCard({ title, description, status, pnl, allocated, icon }: StrategyProps) {
    return (
        <div className="flex flex-col gap-6 p-8 bg-card rounded-3xl border border-card-border hover:border-primary/30 transition-all group overflow-hidden relative">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all"></div>

            <div className="flex items-start justify-between">
                <div className="p-4 bg-background rounded-2xl border border-card-border group-hover:bg-primary/5 transition-all">
                    {icon}
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-card-border">
                    <div className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-accent animate-pulse' : 'bg-zinc-600'}`}></div>
                    <span className="text-[10px] font-black text-zinc-400 tracking-widest">{status}</span>
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
                    <span className={`text-lg font-mono font-bold ${Number(pnl.replace('$', '')) > 0 ? 'text-accent' : 'text-zinc-300'}`}>
                        {pnl}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Allocated</span>
                    <span className="text-lg font-mono font-bold text-zinc-300">
                        {allocated}
                    </span>
                </div>
            </div>

            <button className="w-full py-4 bg-background hover:bg-zinc-800 text-zinc-400 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl border border-card-border transition-all">
                MANAGE DEPLOYMENT FUNDS
            </button>
        </div>
    )
}
