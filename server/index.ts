import express, { type Request, Response, NextFunction } from "express";
import registerRoutes from './routes';
import { setupVite, serveStatic, log } from "./vite";
import 'dotenv/config';
import { 
  createRateLimiter, 
  sanitizeInput, 
  requestTimeout, 
  securityHeaders, 
  requestId 
} from "./middleware";
import { isDevelopment, DEFAULT_PORT, API_TIMEOUT } from "./constants";

const app = express();

// Security and utility middleware
app.use(securityHeaders);
app.use(requestId);
app.use(sanitizeInput);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Rate limiting for API endpoints (100 requests per minute)
app.use('/api', createRateLimiter({ windowMs: 60000, max: 100 }));

// Request timeout for non-upload/download endpoints
app.use(requestTimeout(API_TIMEOUT));

// Request logging middleware (only logs in development or for API calls)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") && isDevelopment()) {
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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('[Error Handler]', err);
    }

    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Get port from environment or use default
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  
  server.listen({
    port,
    host: "localhost",
  }, () => {
    log(`Server running on port ${port} (${isDevelopment() ? 'development' : 'production'})`);
  });
})();
