/**
 * Enhanced Fetch Utility with Timeout, Retry Logic, and Exponential Backoff
 * 
 * Provides a production-ready fetch wrapper that handles:
 * - Request timeouts
 * - Automatic retries with exponential backoff
 * - Network error handling
 * - Status code validation
 * - Comprehensive error logging
 */

import logger from '@/lib/utils/logger';

/**
 * Extended fetch options with retry and timeout support
 */
export interface FetchWithRetryOptions extends RequestInit {
  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
  
  /**
   * Number of retry attempts on failure
   * @default 3
   */
  retries?: number;
  
  /**
   * Initial delay between retries in milliseconds
   * @default 1000 (1 second)
   */
  retryDelay?: number;
  
  /**
   * Whether to use exponential backoff for retries
   * @default true
   */
  exponentialBackoff?: boolean;
  
  /**
   * HTTP status codes that should trigger a retry
   * @default [408, 429, 500, 502, 503, 504]
   */
  retryOn?: number[];
  
  /**
   * Custom retry condition function
   * @param response The fetch response
   * @returns true to retry, false to not retry
   */
  shouldRetry?: (response: Response) => boolean;
  
  /**
   * Callback function called before each retry attempt
   * @param attempt Current attempt number (1-based)
   * @param error The error that triggered the retry
   */
  onRetry?: (attempt: number, error: Error) => void;
  
  /**
   * Whether to log errors (useful for silencing expected errors)
   * @default true
   */
  logErrors?: boolean;
}

/**
 * Fetch error with additional context
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly response?: Response,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/**
 * Default status codes that should trigger a retry
 */
const DEFAULT_RETRY_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  useExponentialBackoff: boolean
): number {
  if (!useExponentialBackoff) {
    return baseDelay;
  }
  
  // Exponential backoff with jitter
  // Formula: baseDelay * (2 ^ attempt) + random jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 1000; // Random jitter up to 1 second
  
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Enhanced fetch with timeout, retry, and exponential backoff
 * 
 * @example
 * ```typescript
 * // Simple usage with defaults
 * const response = await fetchWithRetry('https://api.example.com/data');
 * 
 * // Custom configuration
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   timeout: 10000,      // 10 second timeout
 *   retries: 5,          // 5 retry attempts
 *   retryDelay: 2000,    // 2 second initial delay
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(data),
 *   onRetry: (attempt, error) => {
 *     logger.log(`Retry attempt ${attempt}: ${error.message}`);
 *   }
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    retryOn = DEFAULT_RETRY_STATUS_CODES,
    shouldRetry,
    onRetry,
    logErrors = true,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Merge abort signal with user's signal if provided
      const signal = fetchOptions.signal
        ? mergeSignals([controller.signal, fetchOptions.signal])
        : controller.signal;

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal,
        });

        clearTimeout(timeoutId);

        // Check if we should retry based on status code
        const shouldRetryStatus = retryOn.includes(response.status);
        const customRetryDecision = shouldRetry ? shouldRetry(response) : false;
        
        if ((shouldRetryStatus || customRetryDecision) && attempt <= retries) {
          lastResponse = response;
          throw new FetchError(
            `Request failed with status ${response.status}`,
            url,
            response.status,
            response.statusText,
            response
          );
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if we've exhausted attempts
      if (attempt > retries) {
        if (logErrors) {
          logger.error('Fetch failed after all retry attempts', {
            url,
            attempts: attempt,
            error: lastError.message,
          });
        }
        throw new FetchError(
          `Request failed after ${retries} retries: ${lastError.message}`,
          url,
          lastResponse?.status,
          lastResponse?.statusText,
          lastResponse,
          lastError
        );
      }
      
      // Check if error is retryable
      if (!isRetryableError(lastError) && !lastResponse) {
        if (logErrors) {
          logger.error('Fetch failed with non-retryable error', {
            url,
            error: lastError.message,
          });
        }
        throw new FetchError(
          `Request failed: ${lastError.message}`,
          url,
          undefined,
          undefined,
          undefined,
          lastError
        );
      }
      
      // Calculate delay for next retry
      const delay = calculateDelay(attempt, retryDelay, exponentialBackoff);
      
      if (logErrors) {
        logger.warn(`Fetch attempt ${attempt} failed, retrying in ${delay}ms...`, {
          url,
          error: lastError.message,
          nextAttempt: attempt + 1,
          maxAttempts: retries + 1,
        });
      }
      
      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript doesn't know that
  throw lastError || new Error('Unexpected error in fetchWithRetry');
}

/**
 * Helper to merge multiple AbortSignals
 */
function mergeSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  
  return controller.signal;
}

/**
 * Convenience wrapper for JSON responses with automatic retry
 * 
 * @example
 * ```typescript
 * const data = await fetchJSON<User>('https://api.example.com/user/123');
 * ```
 */
export async function fetchJSON<T = any>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new FetchError(
      `HTTP ${response.status}: ${errorText}`,
      url,
      response.status,
      response.statusText,
      response
    );
  }

  return response.json();
}

/**
 * Convenience wrapper for text responses with automatic retry
 */
export async function fetchText(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<string> {
  const response = await fetchWithRetry(url, options);

  if (!response.ok) {
    throw new FetchError(
      `HTTP ${response.status}: ${response.statusText}`,
      url,
      response.status,
      response.statusText,
      response
    );
  }

  return response.text();
}

/**
 * Convenience wrapper for blob responses (images, files) with automatic retry
 */
export async function fetchBlob(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Blob> {
  const response = await fetchWithRetry(url, options);

  if (!response.ok) {
    throw new FetchError(
      `HTTP ${response.status}: ${response.statusText}`,
      url,
      response.status,
      response.statusText,
      response
    );
  }

  return response.blob();
}
