import { TradingStrategy, BotStatus, BotState } from './types.js';
import { intelEmitter } from '../intel.js';
import { publicClient } from '../viemClient.js';
import { isLiveMode } from '../config/runtimeConfig.js';

export abstract class BaseStrategy implements TradingStrategy {
    public id: string;
    public name: string;
    protected status: BotStatus = 'IDLE';
    protected pnl: number = 0;
    protected allocated: number;
    protected logs: string[] = [];
    protected interval: NodeJS.Timeout | null = null;
    protected client = publicClient;

    constructor(id: string, name: string, allocated: number) {
        this.id = id;
        this.name = name;
        this.allocated = allocated;
    }

    /**
     * Check if bot should run in dry run mode.
     * Uses runtime config which can be toggled via API.
     */
    protected get dryRun(): boolean {
        return !isLiveMode();
    }

    public start(): void {
        if (this.status === 'RUNNING') return;
        this.status = 'RUNNING';

        const modeText = this.dryRun ? '[DRY RUN]' : '[LIVE]';
        this.log(`${modeText} Neural link established. Bot operational.`, 'success');

        // Run immediately, then every 10 seconds
        this.run();
        this.interval = setInterval(() => this.run(), 10000);
    }

    public stop(): void {
        this.status = 'IDLE';
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.log('Bot deactivated. Standing by.', 'warning');
    }

    public abstract run(): Promise<void>;

    public getState(): BotState {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            pnl: this.pnl,
            allocated: this.allocated,
            lastUpdate: new Date().toISOString(),
            logs: this.logs,
            dryRun: this.dryRun,
        };
    }

    /**
     * Set dry run mode - now uses runtime config.
     * Call setLiveMode() from runtimeConfig instead.
     */
    public setDryRun(enabled: boolean): void {
        // Import is handled via getter, this is just for logging
        const modeText = enabled ? 'DRY RUN mode' : 'LIVE mode';
        this.log(`Switched to ${modeText}`, 'warning', 'high');
    }

    /**
     * Check if bot is in dry run mode.
     */
    public isDryRun(): boolean {
        return this.dryRun;
    }

    protected log(
        msg: string,
        type: 'info' | 'success' | 'warning' | 'error' = 'info',
        priority: 'low' | 'high' = 'low'
    ) {
        const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
        const logEntry = `[${timestamp}] ${msg}`;

        // Keep last 5 logs
        this.logs = [logEntry, ...this.logs].slice(0, 5);

        intelEmitter.emit('new_intel', {
            time: timestamp,
            msg: `[${this.id.toUpperCase()}] ${msg}`,
            type,
            priority,
        });
    }
}
