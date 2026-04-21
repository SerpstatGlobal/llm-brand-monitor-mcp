import { createHash } from 'crypto';
import { Logger } from './logger.js';

const DEFAULT_TTL = 5 * 60 * 1000;         // 5 minutes
const CLEANUP_INTERVAL = 10 * 60 * 1000;   // 10 minutes

interface CacheEntry {
  result: unknown;
  expiresAt: number;
}

export class ToolCallCache {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<unknown>>();
  private cleanupTimer: ReturnType<typeof setInterval>;
  private ttl: number;
  private logger: Logger;

  constructor(options: { ttl?: number; logger: Logger }) {
    this.ttl = options.ttl ?? DEFAULT_TTL;
    this.logger = options.logger;
    this.cleanupTimer = setInterval(() => this.cleanExpired(), CLEANUP_INTERVAL);
    // Don't keep process alive just for cleanup
    this.cleanupTimer.unref();
  }

  async executeWithCache<T>(
    tokenHash: string,
    toolName: string,
    args: Record<string, unknown>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = this.buildKey(tokenHash, toolName, args);

    // 1. Cache hit?
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.logger.debug(`Cache hit: ${toolName} (key: ${key.slice(0, 16)}...)`);
      return cached.result as T;
    }

    // 2. In-flight dedup?
    const pending = this.inFlight.get(key);
    if (pending) {
      this.logger.debug(`In-flight dedup: ${toolName} (key: ${key.slice(0, 16)}...)`);
      return pending as Promise<T>;
    }

    // 3. Execute fresh
    const promise = fn()
      .then((result) => {
        this.cache.set(key, { result, expiresAt: Date.now() + this.ttl });
        this.inFlight.delete(key);
        return result;
      })
      .catch((error) => {
        // Errors NOT cached — allows retry
        this.inFlight.delete(key);
        throw error;
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  getStats(): { size: number; ttl: number } {
    return { size: this.cache.size, ttl: this.ttl };
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.clear();
  }

  private buildKey(tokenHash: string, toolName: string, args: Record<string, unknown>): string {
    const sortedArgs = JSON.stringify(args, Object.keys(args || {}).sort());
    return createHash('sha256')
      .update(`${tokenHash}:${toolName}:${sortedArgs}`)
      .digest('hex');
  }

  private cleanExpired(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cache cleanup: removed ${removed}, remaining ${this.cache.size}`);
    }
  }
}

/** Hash a token for use as cache key prefix (don't store raw tokens) */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}
