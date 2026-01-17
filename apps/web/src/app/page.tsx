import { TopNav } from "@/components/TopNav";
import { StrategyCard } from "@/components/StrategyCard";
import { MarketSignal } from "@/components/MarketSignal";
import { BotInterface } from "@/components/BotInterface";
import { ActivityFeed } from "@/components/ActivityFeed";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <TopNav />

      <main className="flex-1 p-8 overflow-hidden">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">

          {/* Left Sidebar: Activity Feed */}
          <div className="xl:col-span-3 h-[calc(100vh-140px)] sticky top-24">
            <ActivityFeed />
          </div>

          {/* Main Content Area */}
          <div className="xl:col-span-9 flex flex-col gap-8">

            {/* Strategy Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StrategyCard
                title="Flash Loan Arbitrage"
                description="Monitors price discrepancies between Aerodrome and Uniswap V3 on Base."
                status="IDLE"
                pnl="$0.00"
                allocated="$2,500"
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                    <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L13 16M17 20L21 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              />
              <StrategyCard
                title="CEX-Perp Delta"
                description="Statistical arbitrage between Coinbase/Binance spot and Hyperliquid perps."
                status="IDLE"
                pnl="$0.00"
                allocated="$5,000"
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                    <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              />
              <StrategyCard
                title="Dynamic Grid"
                description="Trend-filtered grid bot for WETH-USDC with dynamic volatility adjustments."
                status="IDLE"
                pnl="$0.00"
                allocated="$1,500"
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  </svg>
                }
              />
            </div>

            {/* AI Signal Banner */}
            <MarketSignal />

            {/* Lower Grid: Analytics & Bot Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-card rounded-[2rem] border border-card-border p-8 min-h-[400px] flex flex-col gap-6 relative overflow-hidden group">
                {/* Chart Placeholder styling */}
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="text-lg font-black text-white uppercase italic tracking-tight">Cumulative PnL (Session)</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Live Delta</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-card-border rounded-3xl group-hover:bg-primary/5 transition-all">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18 9L13 14L10 11L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-zinc-600 font-mono text-xs uppercase tracking-[0.2em]">PNL Data Analytics Loadinging...</p>
                </div>
              </div>

              <div className="lg:col-span-4">
                <BotInterface />
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer className="px-8 py-6 border-t border-card-border flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
        <p>LHC-1 SYSTEM CORE V1.0.4</p>
        <p>Awaiting Command Input...</p>
      </footer>
    </div>
  );
}
