import http from 'http';

function reportDebug(event, data) {
    const payload = JSON.stringify({
        sessionId: 'topup-500-crash',
        runId: 'pre',
        timestamp: new Date().toISOString(),
        event,
        data
    });
    const req = http.request('http://127.0.0.1:7778/event', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
}

export const logger = {
    info: (msg) => {
        console.log(`✅ [INFO] ${new Date().toLocaleTimeString()}: ${msg}`);
        reportDebug('logger-info', { msg });
    },
    error: (msg, meta) => {
        console.error(`❌ [ERROR] ${new Date().toLocaleTimeString()}: ${msg}`, meta || '');
        reportDebug('logger-error', { msg, meta: meta?.message || meta });
    },
    warn: (msg) => {
        console.warn(`⚠️ [WARN] ${new Date().toLocaleTimeString()}: ${msg}`);
        reportDebug('logger-warn', { msg });
    }
};
