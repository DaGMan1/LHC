import { EventEmitter } from 'events';

// Simple event emitter to bridge the scanner and the SSE stream
export const intelEmitter = new EventEmitter();

export interface IntelMessage {
    time: string;
    msg: string;
    type: 'info' | 'success' | 'warning' | 'error';
    priority: 'low' | 'high';
    botId?: string; // Source bot ID (flash-loan, cex-perp, grid-bot, or undefined for system messages)
}

const mockIntels: string[] = [
    'AERODRONE POOL DEPTH INCREASE +1.5%',
    'UNISWAP V3 SCAN COMPLETE: NO ARB FOUND',
    'ARBITRAGE OPPORTUNITY: ETH/USDC 1.2%',
    'GAS PRICE DROPPED TO 0.05 GWEI',
    'MEV VECTOR IDENTIFIED ON BASE - SCANNING...',
    'LIQUIDITY SHIFT: WETH/USDC DEPTH -5%',
    'NEW STRATEGY LOADED: CEX-PERP DELTA',
    'BASE NETWORK CONGESTION: LOW',
];

/**
 * MarketIntelEngine
 * 
 * In a real scenario, this would poll Aerodrome/Uniswap V3 using Viem.
 * For Milestone 1 (MVP Simulation), it generates structured intel logs.
 */
export function startMarketIntelEngine() {
    console.log('--- Market Intel Engine Started ---');

    // Scan every 5 seconds for a louder demo/test
    setInterval(() => {
        const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
        const randomIntel = mockIntels[Math.floor(Math.random() * mockIntels.length)];

        // Priority logic: Arbitrage opportunities are always high priority
        const isPriority = randomIntel.includes('ARBITRAGE') || randomIntel.includes('MEV');

        const message: IntelMessage = {
            time: timestamp,
            msg: randomIntel,
            type: randomIntel.includes('OPPORTUNITY') ? 'success' : (isPriority ? 'warning' : 'info'),
            priority: isPriority ? 'high' : 'low',
        };

        intelEmitter.emit('new_intel', message);
    }, 5000);
}
