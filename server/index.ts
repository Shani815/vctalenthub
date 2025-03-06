import '@/server/config/env';  // Import this first to load environment variables
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import passport from "passport";
import MemoryStore from "memorystore";
import { initCronJobs } from "./services/cron";

const app = express();
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: false }));

// Create MemoryStore instance
const MemoryStoreSession = MemoryStore(session);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Add CORS headers for development
app.use((req, res, next) => {
  // Allow specific origins or use environment variable
  const allowedOrigins = ['http://localhost:5000', 'https://*.repl.co'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.some(allowed => 
    origin === allowed || (allowed.includes('*') && origin.endsWith(allowed.replace('*', '')))
  )) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Setup Vite in development or serve static files in production
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve on port 5000 and bind to all interfaces
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running at http://0.0.0.0:${PORT}`);
      
      // Initialize scheduled jobs
      initCronJobs();
      console.log('Scheduled jobs have been initialized');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();