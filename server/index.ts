import express from "express";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import { randomUUID } from "crypto";
import { registerRoutes } from "./routes";

// ESM/CJS compat: __dirname exists in CJS (esbuild prod), import.meta.dirname in ESM (tsx dev)
// @ts-ignore
const _currentDir: string = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;
import { registerHealthRoutes } from "./routes/health";
import { apiLimiter } from "./middleware/rateLimiter";
import { pool } from "./db";
import { startCacheWarmerSchedule } from "./search/cache-warmer";

// ============= STARTUP ENV VALIDATION =============
const RECOMMENDED_ENV_VARS = ['ADMIN_API_KEY', 'AI_INTEGRATIONS_OPENAI_API_KEY', 'MAPBOX_PUBLIC_TOKEN', 'MAPBOX_SECRET_TOKEN'];
for (const envVar of RECOMMENDED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.warn(`[Startup] WARNING: ${envVar} is not set — related features will be disabled`);
  }
}
if (process.env.ADMIN_API_KEY && !process.env.ADMIN_SESSION_SECRET) {
  console.warn('[Startup] WARNING: ADMIN_SESSION_SECRET not set — falling back to ADMIN_API_KEY for session signing');
}

const app = express();

// Trust the first proxy (Render, Heroku, etc.) for rate limiting
app.set('trust proxy', 1);

// ============= CANONICAL DOMAIN REDIRECT =============
// Redirect Render subdomain to custom domain (301 for SEO consolidation)
const CANONICAL_HOST = 'albertaresourcehub.ca';
app.use((req, res, next) => {
  const host = req.hostname;
  if (host && host !== CANONICAL_HOST && host !== `www.${CANONICAL_HOST}` && host.endsWith('.onrender.com')) {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }
  next();
});

// ============= REQUEST CORRELATION IDS =============
// Add unique correlation ID to each request for debugging
app.use((req, res, next) => {
  const rawId = req.headers['x-correlation-id'] as string;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const correlationId = (rawId && UUID_RE.test(rawId)) ? rawId : randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Security headers via Helmet
const isDev = process.env.NODE_ENV === 'development';
app.use(helmet({
  contentSecurityPolicy: isDev
    ? false  // Disable CSP in dev — Vite HMR needs inline scripts/WebSocket
    : {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'sha256-89M0NrPPkqSqhCiULjcep6eafhzUKPIkDn/yEiWOafg='"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:", "https://api.mapbox.com"],
          connectSrc: ["'self'", "https://api.mapbox.com", "https://events.mapbox.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          workerSrc: ["'self'", "blob:"],
          childSrc: ["blob:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
  crossOriginEmbedderPolicy: false,
}));

// CORS: restrict API access to known origins (configurable via env var)
const defaultOrigins = [
  'https://albertaresourcehub.ca',
  'https://www.albertaresourcehub.ca',
  'https://resourcehub-wwg6.onrender.com',
  'https://recoveryoncampusalberta.ca',
  'https://www.recoveryoncampusalberta.ca',
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : defaultOrigins;
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5000', 'http://localhost:5173');
}
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH'],
  credentials: true,
  maxAge: 86400, // Cache preflight for 24 hours
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-CSRF-Token', 'X-Correlation-Id'],
}));

app.use(compression());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Validate Content-Type for POST/PUT/PATCH requests
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.path.startsWith('/health')) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported Media Type',
        error: 'Content-Type must be application/json'
      });
    }
  }
  next();
});

// CSRF defense: CORS origin allowlist (lines 60-66) rejects cross-origin requests.
// See middleware/csrf.ts for strictCsrfProtection if token-based CSRF is needed later.

// Apply global rate limiting to all routes (except health checks)
app.use((req, res, next) => {
  // Skip rate limiting for health check endpoints
  if (req.path.startsWith('/api/health')) {
    return next();
  }
  apiLimiter(req, res, next);
});

const httpServer = createServer(app);

// ============= GRACEFUL SHUTDOWN =============
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(async (err) => {
    if (err) {
      console.error('Error during HTTP server close:', err);
    }

    console.log('HTTP server closed');

    // Close database pool
    try {
      await pool.end();
      console.log('Database pool closed');
    } catch (dbErr) {
      console.error('Error closing database pool:', dbErr);
    }

    console.log('Graceful shutdown complete');
    process.exit(err ? 1 : 0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

(async () => {
  // Register health routes first (no rate limiting)
  registerHealthRoutes(app as any);

  // Register main routes (search, feedback, analytics)
  await registerRoutes(httpServer, app);

  if (process.env.NODE_ENV === 'development') {
    // Dev mode: Vite middleware for HMR — single process, one port
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve pre-built static files
    const clientBuildPath = path.join(_currentDir, "../dist/public");
    app.use(express.static(clientBuildPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(clientBuildPath, "index.html"));
    });
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dev server with HMR at http://localhost:${port}`);
    }
    console.log(`Health check available at http://localhost:${port}/api/health`);

    // Start category cache warmer (non-blocking, 30s delay)
    startCacheWarmerSchedule();
  });
})();
