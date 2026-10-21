/**
 * Production-safe logging utility
 * Automatically disables console logs in production environment
 */

import { config } from '@/config';

const isProduction = !config.app.isDevelopment;

const logger = {
  log: (...args: any[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (!isProduction) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, even in production (for debugging critical issues)
    console.error(...args);
  },
  
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },

  group: (...args: any[]) => {
    if (!isProduction) {
      console.group(...args);
    }
  },

  groupCollapsed: (...args: any[]) => {
    if (!isProduction) {
      console.groupCollapsed(...args);
    }
  },

  groupEnd: () => {
    if (!isProduction) {
      console.groupEnd();
    }
  }
};

export { logger };
export default logger;

