import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { startMarketIntelEngine, intelEmitter, IntelMessage } from './intel';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// SSE Endpoint for Live Intel
app.get('/api/intel', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onNewIntel = (data: IntelMessage) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    intelEmitter.on('new_intel', onNewIntel);

    req.on('close', () => {
        intelEmitter.off('new_intel', onNewIntel);
    });
});

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
    startMarketIntelEngine();
});

