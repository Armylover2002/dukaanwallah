import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'mongo-sanitize';
import xssClean from 'xss-clean';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { responseTimeLogger } from './middleware/responseTimeLogger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { healthCheck } from './config/health.js';
import { config } from './config/env.js';

const app = express();

// Trust first proxy (essential for express-rate-limit if behind a proxy like Render)
app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// MUST be the VERY FIRST middleware so that EVEN Render's own 502/503 error
// responses carry the Allow-Origin header. Without this, the browser sees a
// 502 without CORS headers and reports it as "CORS Missing Allow Origin".
const allowedOrigins = [
    'https://dukaanwallah.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    // Additional origins from env (comma-separated, e.g. staging URLs)
    ...(process.env.ADDITIONAL_CORS_ORIGINS
        ? process.env.ADDITIONAL_CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
        : []),
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        // Match exact list OR any dukaanwallah*.vercel.app preview deploy URL
        const isAllowed =
            allowedOrigins.includes(origin) ||
            /^https:\/\/dukaanwallah.*\.vercel\.app$/.test(origin);
        return isAllowed
            ? callback(null, true)
            : callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
};

app.use(cors(corsOptions));
// Explicitly handle OPTIONS preflight for ALL routes (critical for browsers)
app.options('*', cors(corsOptions));

// ─── Compression ──────────────────────────────────────────────────────────────
// Gzip-compress all JSON/text responses → reduces bandwidth ~60-70%
// and lowers Render's memory pressure under heavy load
app.use(compression());

// ─── Request ID tracing ───────────────────────────────────────────────────────
app.use(requestIdMiddleware);

// ─── Health endpoints (no rate-limit, no auth) ────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        const data = await healthCheck();
        res.status(200).json(data);
    } catch (err) {
        res.status(503).json({ status: 'DOWN', error: 'Health check failed' });
    }
});
app.get('/ready', (_req, res) => {
    res.status(200).json({ status: 'ready' });
});

// ─── Security middlewares ─────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
    hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 'combined' in production: less verbose, no color codes, lower CPU usage
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(express.json({
    limit: config.requestBodyLimit,
    verify: (req, res, buf) => {
        // Store rawBody for Razorpay webhook signature verification
        if (req.originalUrl && req.originalUrl.includes('/webhook/razorpay')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: config.requestBodyLimit }));

// Protect against NoSQL injection and XSS
app.use((req, _res, next) => {
    req.body = mongoSanitize(req.body);
    req.query = mongoSanitize(req.query);
    req.params = mongoSanitize(req.params);
    next();
});
app.use(xssClean());

// Global rate limiting for API routes
app.use('/api', apiRateLimiter);

// Optional: log API response time (method, path, status, duration) - no sensitive data
app.use('/api', responseTimeLogger);

// API Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);

export default app;