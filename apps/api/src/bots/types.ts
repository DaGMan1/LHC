export type BotStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';

export interface BotState {
    id: string;
    name: string;
    status: BotStatus;
    pnl: number;
    allocated: number;
    lastUpdate: string;
    logs: string[];
    dryRun: boolean;
}

export interface TradingStrategy {
    id: string;
    name: string;
    run(): Promise<void>;
    start(): void;
    stop(): void;
    getState(): BotState;
    setDryRun?(enabled: boolean): void;
    isDryRun?(): boolean;
}
