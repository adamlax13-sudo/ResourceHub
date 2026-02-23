import express from "express";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import { randomUUID } from "crypto";
import { registerRoutes } from "./routes";
import { registerHealthRoutes } from "./routes/health";
import { apiLimiter } from "./middleware/rateLimiter";
import { pool } from "./db";
import { csrfProtection, csrfTokenEndpoint } from "./middleware/csrf";

const app = express();

// Trust the first proxy (Render, Heroku, etc.) for rate limiting
app.set('trust proxy', 1);

// ============= REQUEST CORRELATION IDS =============
// Add unique correlation ID to each request for debugging
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS: restrict API access to your Render domain and localhost dev
const allowedOrigins = [
  'https://resourcehub-wwg6.onrender.com',
  'https://recoveryoncampusalberta.ca',
  'https://www.recoveryoncampusalberta.ca',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5000', 'http://localhost:5173');
}
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
  maxAge: 86400, // Cache preflight for 24 hours
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-CSRF-Token', 'X-Correlation-Id'],
}));

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false }));

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

// CSRF protection for state-changing requests
app.use('/api', csrfProtection(allowedOrigins));

// CSRF token endpoint for clients to fetch tokens
app.get('/api/csrf-token', csrfTokenEndpoint);

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

  const clientBuildPath = path.join(__dirname, "../dist/public");
  app.use(express.static(clientBuildPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    console.log(`Health check available at http://localhost:${port}/api/health`);
  });
})();
