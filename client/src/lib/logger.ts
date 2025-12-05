/**
 * Production-aware logging utility
 * Only logs in development environment to prevent console noise in production
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    // Always show warnings
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always show errors
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

export default logger;

