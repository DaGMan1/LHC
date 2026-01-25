import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { formatEther } from 'viem';
import { startMarketIntelEngine, intelEmitter, IntelMessage } from './intel.js';
import { botManager } from './bots/BotManager.js';
import {
    publicClient,
    getGasPrice,
    isBotWalletConfigured,
    getBotWalletInfo,
    getGasPriceInfo,
    getBotAddress,
} from './viemClient.js';
import { isFlashArbConfigured, getFlashArbClient, resetFlashArbClient } from './contracts/FlashArbClient.js';
import { BASE_TOKENS } from './oracles/PriceOracle.js';
import {
    getConfig,
    setContractAddress,
    setLiveMode,
    isLiveMode,
    isContractConfigured,
    setBotWalletAddress,
    getContractAddress,
} from './config/runtimeConfig.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================
// SSE ENDPOINT FOR LIVE INTEL & BOT STATUS
// ============================================

app.get('/api/intel', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onNewIntel = (data: IntelMessage) => {
        res.write(`data: ${JSON.stringify({ type: 'intel', data })}\n\n`);
    };

    intelEmitter.on('new_intel', onNewIntel);

    // Initial bot states
    res.write(`data: ${JSON.stringify({ type: 'bots', data: botManager.getAllStates() })}\n\n`);

    const botInterval = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'bots', data: botManager.getAllStates() })}\n\n`);
    }, 5000);

    req.on('close', () => {
        intelEmitter.off('new_intel', onNewIntel);
        clearInterval(botInterval);
    });
});

// ============================================
// BOT CONTROLS
// ============================================

app.get('/api/bots', (req, res) => {
    res.json(botManager.getAllStates());
});

app.post('/api/bots/:id/start', (req, res) => {
    botManager.startBot(req.params.id);
    res.json({ status: 'started', id: req.params.id });
});

app.post('/api/bots/:id/stop', (req, res) => {
    botManager.stopBot(req.params.id);
    res.json({ status: 'stopped', id: req.params.id });
});

// Toggle dry run / live mode
app.post('/api/bots/:id/mode', (req, res) => {
    const { dryRun } = req.body;
    const bot = botManager.getBot(req.params.id);

    if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
    }

    if (bot.setDryRun) {
        bot.setDryRun(!!dryRun);
        res.json({
            status: 'ok',
            id: req.params.id,
            dryRun: !!dryRun,
            mode: dryRun ? 'dry_run' : 'live',
        });
    } else {
        res.status(400).json({ error: 'Bot does not support mode switching' });
    }
});

// Emergency stop all bots
app.post('/api/bots/emergency-stop', (req, res) => {
    const states = botManager.getAllStates();
    let stoppedCount = 0;

    for (const state of states) {
        if (state.status === 'RUNNING') {
            botManager.stopBot(state.id);
            stoppedCount++;
        }
    }

    res.json({
        status: 'emergency_stop_executed',
        stoppedCount,
        message: `Stopped ${stoppedCount} running bot(s)`,
    });
});

// ============================================
// BOT WALLET STATUS
// ============================================

app.get('/api/bot-wallet/status', async (req, res) => {
    try {
        if (!isBotWalletConfigured()) {
            return res.json({
                configured: false,
                message: 'Bot wallet not configured. Set BOT_PRIVATE_KEY in .env',
            });
        }

        const info = await getBotWalletInfo();
        const gasInfo = await getGasPriceInfo();

        res.json({
            configured: true,
            address: info.address,
            balanceEth: info.balanceEth,
            gasPrice: gasInfo.current,
            gasPriceAcceptable: gasInfo.acceptable,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================
// CONTRACT STATUS
// ============================================

app.get('/api/contract/status', async (req, res) => {
    try {
        if (!isFlashArbConfigured()) {
            return res.json({
                configured: false,
                message: 'Contract not configured. Set FLASH_ARB_CONTRACT_ADDRESS in .env',
            });
        }

        const client = getFlashArbClient();
        const isPaused = await client.isPaused();
        const owner = await client.getOwner();

        // Check if bot wallet is authorized
        let botAuthorized = false;
        if (isBotWalletConfigured()) {
            botAuthorized = await client.isBotAuthorized();
        }

        // Get contract balances
        const wethBalance = await client.getContractBalance(BASE_TOKENS.WETH);
        const usdcBalance = await client.getContractBalance(BASE_TOKENS.USDC);

        res.json({
            configured: true,
            address: process.env.FLASH_ARB_CONTRACT_ADDRESS,
            owner,
            isPaused,
            botAuthorized,
            balances: {
                WETH: formatEther(wethBalance),
                USDC: (Number(usdcBalance) / 1e6).toFixed(2),
            },
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================
// SYSTEM STATUS
// ============================================

app.get('/api/system/status', async (req, res) => {
    try {
        const blockNumber = await publicClient.getBlockNumber();
        const gasPrice = await getGasPrice();
        const botStates = botManager.getAllStates();

        const runningBots = botStates.filter((b) => b.status === 'RUNNING').length;
        const totalPnl = botStates.reduce((sum, b) => sum + b.pnl, 0);

        // Get bot wallet address if configured
        let botWalletAddress: string | null = null;
        try {
            if (isBotWalletConfigured()) {
                botWalletAddress = getBotAddress();
            }
        } catch {}

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            mode: isLiveMode() ? 'LIVE' : 'DRY_RUN',
            blockchain: {
                network: 'base',
                blockNumber: blockNumber.toString(),
                gasPrice: `${(Number(gasPrice) / 1e9).toFixed(4)} gwei`,
            },
            bots: {
                total: botStates.length,
                running: runningBots,
                totalPnl: totalPnl.toFixed(2),
            },
            config: {
                botWalletConfigured: isBotWalletConfigured(),
                botWalletAddress,
                contractConfigured: isFlashArbConfigured(),
                contractAddress: getContractAddress(),
                liveMode: isLiveMode(),
            },
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================
// RUNTIME CONFIGURATION (Dynamic via Web UI)
// ============================================

// Get current config
app.get('/api/config', (req, res) => {
    let botWalletAddress: string | null = null;
    try {
        if (isBotWalletConfigured()) {
            botWalletAddress = getBotAddress();
        }
    } catch {}

    res.json({
        contractAddress: getContractAddress(),
        liveMode: isLiveMode(),
        botWalletConfigured: isBotWalletConfigured(),
        botWalletAddress,
        contractConfigured: isFlashArbConfigured(),
    });
});

// Set contract address (called after deployment from web UI)
app.post('/api/config/contract', (req, res) => {
    const { address } = req.body;

    if (!address || !address.startsWith('0x') || address.length !== 42) {
        return res.status(400).json({ error: 'Invalid contract address format' });
    }

    try {
        setContractAddress(address);
        resetFlashArbClient(); // Reset client to use new address
        res.json({
            status: 'ok',
            contractAddress: address,
            message: 'Contract address configured. Ready for trading.',
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to set contract address',
        });
    }
});

// Toggle live mode (THE BIG BUTTON)
app.post('/api/config/live', (req, res) => {
    const { enabled } = req.body;

    // Validate prerequisites before going live
    if (enabled) {
        if (!isBotWalletConfigured()) {
            return res.status(400).json({
                error: 'Cannot go live: Bot wallet not configured (BOT_PRIVATE_KEY missing)',
                liveMode: false,
            });
        }

        if (!isFlashArbConfigured()) {
            return res.status(400).json({
                error: 'Cannot go live: Contract not configured. Deploy contract first.',
                liveMode: false,
            });
        }
    }

    setLiveMode(!!enabled);

    // Log mode change to intel feed
    intelEmitter.emit('new_intel', {
        time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        msg: enabled
            ? '🚀 LIVE MODE ACTIVATED - Autonomous trading enabled'
            : '⏸️ DRY RUN MODE - Simulation only',
        type: enabled ? 'success' : 'warning',
        priority: 'high',
    });

    res.json({
        status: 'ok',
        liveMode: isLiveMode(),
        message: enabled ? 'LIVE MODE: Autonomous trading enabled' : 'DRY RUN: Simulation mode',
    });
});

// Start everything with one click (after contract is deployed)
app.post('/api/go-live', async (req, res) => {
    const { contractAddress } = req.body;

    try {
        // Step 1: Set contract address if provided
        if (contractAddress) {
            if (!contractAddress.startsWith('0x') || contractAddress.length !== 42) {
                return res.status(400).json({ error: 'Invalid contract address format' });
            }
            setContractAddress(contractAddress);
            resetFlashArbClient();
        }

        // Step 2: Validate prerequisites
        if (!isBotWalletConfigured()) {
            return res.status(400).json({
                error: 'Bot wallet not configured (BOT_PRIVATE_KEY missing in .env)',
                step: 'bot_wallet',
            });
        }

        if (!isFlashArbConfigured()) {
            return res.status(400).json({
                error: 'Contract not configured. Deploy contract first.',
                step: 'contract',
            });
        }

        // Step 3: Check if bot is authorized on contract
        const client = getFlashArbClient();
        const botAuthorized = await client.isBotAuthorized();

        if (!botAuthorized) {
            return res.status(400).json({
                error: 'Bot wallet is not authorized as executor. Use the web UI to authorize it first.',
                step: 'executor',
                botWalletAddress: getBotAddress(),
            });
        }

        // Step 4: Enable live mode
        setLiveMode(true);

        // Step 5: Start the flash loan bot
        botManager.startBot('flash-loan');

        // Emit success to intel feed
        intelEmitter.emit('new_intel', {
            time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
            msg: '🚀 SYSTEM LIVE - Flash Loan Arbitrage bot running autonomously',
            type: 'success',
            priority: 'high',
        });

        res.json({
            status: 'ok',
            liveMode: true,
            message: 'System is LIVE! Flash Loan bot running autonomously.',
            botWalletAddress: getBotAddress(),
            contractAddress: getContractAddress(),
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to go live',
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// START SERVER
// ============================================

app.listen(Number(port), '0.0.0.0', () => {
    const mode = process.env.DRY_RUN === 'false' ? 'LIVE (autonomous)' : 'DRY RUN (simulation)';
    console.log(`========================================`);
    console.log(`LHC-1 API Server`);
    console.log(`========================================`);
    console.log(`Port: ${port}`);
    console.log(`Mode: ${mode}`);
    console.log(`Bot wallet: ${isBotWalletConfigured() ? 'Configured' : 'NOT CONFIGURED'}`);
    console.log(`Contract: ${isFlashArbConfigured() ? 'Configured' : 'NOT CONFIGURED'}`);
    console.log(`========================================`);
    console.log(`Health: http://0.0.0.0:${port}/health`);
    console.log(`Status: http://0.0.0.0:${port}/api/system/status`);
    console.log(`========================================`);
    startMarketIntelEngine();
});
