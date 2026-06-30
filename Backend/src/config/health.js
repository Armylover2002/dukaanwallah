import mongoose from 'mongoose';
import { config } from './env.js';
import { getRedisClient } from './redis.js';

/**
 * Minimal health check: server, MongoDB, Redis (if enabled), memory.
 * Does not expose internal secrets.
 */
export const healthCheck = async () => {
    const mongoState = mongoose.connection.readyState;
    const mongoOk = mongoState === 1; // 1 = connected

    let redisOk = null;
    if (config.redisEnabled) {
        const client = getRedisClient();
        redisOk = client ? 'ok' : 'unavailable';
        if (client) {
            try {
                await client.ping();
            } catch {
                redisOk = 'unavailable';
            }
        }
    } else {
        redisOk = 'disabled';
    }

    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const heapPct = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0;
    const memStatus = heapPct > 90 ? 'critical' : heapPct > 75 ? 'warning' : 'ok';

    const overallStatus = mongoOk ? 'UP' : 'DOWN';

    return {
        status: overallStatus,
        mongo: mongoOk ? 'connected' : 'disconnected',
        redis: redisOk,
        memory: {
            heapUsedMB,
            heapTotalMB,
            heapPct,
            status: memStatus,
        },
        uptime: Math.round(process.uptime()),
    };
};
