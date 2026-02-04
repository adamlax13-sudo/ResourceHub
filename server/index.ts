import express from "express";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { apiLimiter } from "./middleware/rateLimiter";

const app = express();

// Trust the first proxy (Render, Heroku, etc.) for rate limiting
app.set('trust proxy', 1);

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
}));

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false }));

// Apply global rate limiting to all routes
app.use(apiLimiter);

const httpServer = createServer(app);

(async () => {
  await registerRoutes(httpServer, app);

  const clientBuildPath = path.join(__dirname, "../dist/public");
  app.use(express.static(clientBuildPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
})();
