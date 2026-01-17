import { EventEmitter } from 'events';

// Simple event emitter to bridge the scanner and the SSE stream
export const intelEmitter = new EventEmitter();

export interface IntelMessage {
    time: string;
    msg: string;
    type: 'info' | 'success' | 'warning' | 'error';
    priority: 'low' | 'high';
}

const mockIntels: string[] = [
    'AERODRONE POOL DEPTH INCREASE',
    'UNISWAP V3 SCAN COMPLETE',
    'ARBITRAGE OPPORTUNITY DETECTED',
    'GAS PRICE DROPPED TO 0.1 GWEI',
    'MEV VECTOR IDENTIFIED ON BASE',
    'LIQUIDITY SHIFT: WETH/USDC',
];

/**
 * MarketIntelEngine
 * 
 * In a real scenario, this would poll Aerodrome/Uniswap V3 using Viem.
 * For Milestone 1 (MVP Simulation), it generates structured intel logs.
 */
export function startMarketIntelEngine() {
    console.log('--- Market Intel Engine Started ---');

    // Scan every 30 seconds as per PRD
    setInterval(() => {
        const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
        const randomIntel = mockIntels[Math.floor(Math.random() * mockIntels.length)];
        const isPriority = Math.random() > 0.8;

        const message: IntelMessage = {
            time: timestamp,
            msg: randomIntel,
            type: isPriority ? 'warning' : 'info',
            priority: isPriority ? 'high' : 'low',
        };

        intelEmitter.emit('new_intel', message);
    }, 15000); // Faster simulation during dev (15s instead of 30s)
}
