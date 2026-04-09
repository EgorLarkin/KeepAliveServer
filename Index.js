import http from 'http';
import https from 'https';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3010;
const TARGET_URL = process.env.TARGET_URL || 'https://messangerserver-1.onrender.com/ping';
const PING_INTERVAL_MS = Number(process.env.PING_INTERVAL_MS || 14 * 60 * 1000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

function pingUrl(urlString) {
    return new Promise((resolve, reject) => {
        const client = urlString.startsWith('https://') ? https : http;

        const req = client.get(urlString, {
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'User-Agent': 'messanger-keepalive/1.0'
            }
        }, res => {
            let body = '';

            res.on('data', chunk => {
                body += chunk.toString();
            });

            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    body
                });
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error('Request timeout'));
        });

        req.on('error', err => {
            reject(err);
        });
    });
}

async function performPing() {
    const startedAt = new Date().toISOString();

    try {
        const result = await pingUrl(TARGET_URL);
        console.log(`[${startedAt}] Ping -> ${TARGET_URL} | status=${result.status} | ok=${result.ok}`);
    } catch (error) {
        console.error(`[${startedAt}] Ping failed -> ${TARGET_URL} | error=${error.message}`);
    }
}

app.get('/', (req, res) => {
    res.json({
        success: true,
        service: 'messanger-keepalive',
        target: TARGET_URL,
        intervalMs: PING_INTERVAL_MS,
        now: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        now: new Date().toISOString()
    });
});

app.post('/trigger', async (req, res) => {
    try {
        const result = await pingUrl(TARGET_URL);
        res.json({
            success: result.ok,
            status: result.status,
            body: result.body
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Keepalive service running on port ${PORT}`);
    console.log(`Target URL: ${TARGET_URL}`);
    console.log(`Ping interval: ${PING_INTERVAL_MS} ms`);

    performPing();
    setInterval(performPing, PING_INTERVAL_MS);
});