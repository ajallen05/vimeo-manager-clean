// Middleware utilities for the Vimeo Manager server
import type { Request, Response, NextFunction } from "express";
import { logger } from "./utils";

// Simple in-memory rate limiter
interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max requests per window
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || record.resetTime < now) {
      // Create new record or reset expired one
      record = { count: 1, resetTime: now + config.windowMs };
      rateLimitStore.set(key, record);
      return next();
    }
    
    if (record.count >= config.max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', config.max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', record.resetTime.toString());
      
      logger.warn(`Rate limit exceeded for ${key}`);
      return res.status(429).json({
        message: 'Too many requests, please try again later',
        retryAfter
      });
    }
    
    record.count++;
    res.setHeader('X-RateLimit-Limit', config.max.toString());
    res.setHeader('X-RateLimit-Remaining', (config.max - record.count).toString());
    res.setHeader('X-RateLimit-Reset', record.resetTime.toString());
    
    next();
  };
}

// Input sanitization middleware
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  // Sanitize common string fields in body
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      const value = req.body[key];
      if (typeof value === 'string') {
        // Trim whitespace and remove null bytes
        req.body[key] = value.trim().replace(/\0/g, '');
      }
    }
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string') {
        req.query[key] = value.trim().replace(/\0/g, '');
      }
    }
  }
  
  next();
}

// Request timeout middleware
export function requestTimeout(timeoutMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for upload/download endpoints that need more time
    const skipPaths = ['/api/videos/upload', '/api/videos/bulk-download', '/api/videos/export'];
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timeout: ${req.method} ${req.path}`);
        res.status(408).json({ message: 'Request timeout' });
      }
    }, timeoutMs);
    
    res.on('finish', () => clearTimeout(timeoutId));
    res.on('close', () => clearTimeout(timeoutId));
    
    next();
  };
}

// Security headers middleware
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// Request ID middleware for tracing
let requestIdCounter = 0;
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = `${Date.now()}-${++requestIdCounter}`;
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

