import { formatEther } from 'viem';
import { BaseStrategy } from './BaseStrategy.js';
import { arbitrageScanner, type ArbitrageOpportunity } from '../services/ArbitrageScanner.js';
import {
    getFlashArbClient,
    isFlashArbConfigured,
    type FlashLoanParams,
} from '../contracts/FlashArbClient.js';
import { isBotWalletConfigured } from '../viemClient.js';

export class FlashLoanArb extends BaseStrategy {
    private executionInProgress: boolean = false;
    private consecutiveFailures: number = 0;
    private maxConsecutiveFailures: number = 10;
    private opportunitiesFound: number = 0;
    private tradesExecuted: number = 0;
    private successfulTrades: number = 0;

    constructor() {
        super('flash-loan', 'Flash Loan Arbitrage', 2500);
    }

    public async run(): Promise<void> {
        if (this.status !== 'RUNNING') return;

        // Prevent concurrent executions
        if (this.executionInProgress) {
            return;
        }

        try {
            const blockNumber = await this.client.getBlockNumber();
            this.log(`Scanning Block #${blockNumber}`, 'info');

            // Scan for arbitrage opportunities
            const opportunity = await arbitrageScanner.scan();

            if (!opportunity) {
                // No opportunity found - this is normal
                return;
            }

            // Reset failure counter on successful scan
            this.consecutiveFailures = 0;
            this.opportunitiesFound++;

            // Log the opportunity
            const sizeEth = formatEther(opportunity.recommendedSize);
            this.log(
                `ARB DETECTED: ${opportunity.assetSymbol}/${opportunity.targetSymbol} spread ${(opportunity.netSpreadBps / 100).toFixed(2)}% | Est. profit: $${opportunity.estimatedProfitUsd.toFixed(2)}`,
                'success',
                'high'
            );

            // Check if we should execute (DRY_RUN mode or live)
            if (this.dryRun) {
                this.log(`[DRY RUN] Would execute ${sizeEth} ETH flash loan`, 'info');
                this.pnl += opportunity.estimatedProfitUsd * 0.7; // Simulated 70% capture
            } else {
                // LIVE MODE: Execute the trade autonomously
                await this.executeOpportunity(opportunity);
            }
        } catch (error) {
            this.consecutiveFailures++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.log(`Scan error: ${errorMsg}`, 'error');

            // Auto-pause after too many failures
            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                this.log('Too many consecutive failures. Auto-pausing bot.', 'error', 'high');
                this.stop();
            }
        }
    }

    /**
     * Execute an arbitrage opportunity (AUTONOMOUS).
     */
    private async executeOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
        // Pre-flight checks
        if (!isBotWalletConfigured()) {
            this.log('LIVE MODE: Bot wallet not configured (BOT_PRIVATE_KEY)', 'error');
            return;
        }

        if (!isFlashArbConfigured()) {
            this.log('LIVE MODE: Contract not configured (FLASH_ARB_CONTRACT_ADDRESS)', 'error');
            return;
        }

        this.executionInProgress = true;

        try {
            const sizeEth = formatEther(opportunity.recommendedSize);
            this.log(`EXECUTING: ${sizeEth} ETH flash loan...`, 'warning', 'high');

            // Calculate minimum output with slippage protection
            // We need: amount + premium (0.05%) + slippage buffer (0.5%)
            const premiumBps = BigInt(5); // 0.05%
            const slippageBps = BigInt(50); // 0.5%
            const minAmountOut =
                opportunity.recommendedSize +
                (opportunity.recommendedSize * (premiumBps + slippageBps)) / BigInt(10000);

            // Build flash loan params
            const params: FlashLoanParams = {
                asset: opportunity.asset,
                amount: opportunity.recommendedSize,
                targetToken: opportunity.targetToken,
                poolFee: opportunity.buyPoolFee,
                minAmountOut,
            };

            // Execute the flash loan (AUTONOMOUS - no user interaction)
            const client = getFlashArbClient();
            const result = await client.executeFlashLoan(params);

            this.tradesExecuted++;

            if (result.success) {
                this.consecutiveFailures = 0;
                this.successfulTrades++;
                this.pnl += opportunity.estimatedProfitUsd;

                this.log(
                    `SUCCESS! TX: ${result.txHash.slice(0, 18)}... | Gas: ${result.gasUsed?.toString() || 'N/A'}`,
                    'success',
                    'high'
                );
            } else {
                this.consecutiveFailures++;
                this.log(`FAILED: ${result.error}`, 'error');

                // Auto-pause after too many failures
                if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                    this.log('Too many consecutive failures. Auto-pausing bot.', 'error', 'high');
                    this.stop();
                }
            }
        } finally {
            this.executionInProgress = false;
        }
    }

    /**
     * Get execution statistics.
     */
    public getStats(): {
        opportunitiesFound: number;
        tradesExecuted: number;
        successfulTrades: number;
        successRate: number;
        consecutiveFailures: number;
    } {
        return {
            opportunitiesFound: this.opportunitiesFound,
            tradesExecuted: this.tradesExecuted,
            successfulTrades: this.successfulTrades,
            successRate:
                this.tradesExecuted > 0
                    ? (this.successfulTrades / this.tradesExecuted) * 100
                    : 0,
            consecutiveFailures: this.consecutiveFailures,
        };
    }
}
