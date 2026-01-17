'use client'

export function BotInterface() {
    return (
        <div className="flex flex-col h-full bg-card rounded-[2rem] border border-card-border overflow-hidden group">
            <div className="flex items-center justify-between p-6 border-b border-card-border bg-background/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Alpha-Core AI</h3>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">IDLE</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-12 gap-8 text-center min-h-[300px]">
                <div className="relative group/voice cursor-pointer">
                    <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-0 group-hover/voice:scale-100 transition-all duration-500"></div>
                    <div className="w-24 h-24 bg-background rounded-full border border-card-border flex items-center justify-center relative z-10 group-hover/voice:border-primary/50 transition-all">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-zinc-500 group-hover/voice:text-primary transition-all">
                            <path d="M12 1C11.2044 1 10.4413 1.31607 9.87868 1.87868C9.31607 2.44129 9 3.20435 9 4V12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12V4C15 3.20435 14.6839 2.44129 14.1213 1.87868C13.5587 1.31607 12.7956 1 12 1Z" fill="currentColor" />
                            <path d="M19 10V12C19 13.8565 18.2625 15.637 16.9497 16.9497C15.637 18.2625 13.8565 19 12 19C10.1435 19 8.36301 18.2625 7.05025 16.9497C5.7375 15.637 5 13.8565 5 12V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12 19V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Voice Assistant</h4>
                    <p className="text-sm font-bold text-zinc-400 italic">"Awaiting connection to neural interface..."</p>
                </div>
            </div>

            <div className="p-4 bg-background/50 border-t border-card-border">
                <button className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5 flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    MUTED
                </button>
            </div>
        </div>
    )
}
