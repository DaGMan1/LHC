import { TradingStrategy, BotState } from './types.js';
import { FlashLoanArb } from './FlashLoanArb.js';
import { CexPerpDelta } from './CexPerpDelta.js';
import { GridBot } from './GridBot.js';

export class BotManager {
    private bots: Map<string, TradingStrategy> = new Map();

    constructor() {
        this.registerBot(new FlashLoanArb());
        this.registerBot(new CexPerpDelta());
        this.registerBot(new GridBot());
    }

    private registerBot(bot: TradingStrategy) {
        this.bots.set(bot.id, bot);
    }

    public startBot(id: string) {
        const bot = this.bots.get(id);
        if (bot) bot.start();
    }

    public stopBot(id: string) {
        const bot = this.bots.get(id);
        if (bot) bot.stop();
    }

    public getAllStates(): BotState[] {
        return Array.from(this.bots.values()).map(bot => bot.getState());
    }

    public getBot(id: string): TradingStrategy | undefined {
        return this.bots.get(id);
    }
}

export const botManager = new BotManager();
