type Priority = 1 | 2 | 3; // 1 = user action, 2 = prefetch, 3 = background sync

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  priority: Priority;
  addedAt: number;
}

class RateLimiter {
  private queue: QueuedRequest<unknown>[] = [];
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;
  private processing = false;
  private serverRemaining: number | null = null;

  constructor(maxPerMinute = 60) {
    this.maxTokens = maxPerMinute;
    this.tokens = maxPerMinute;
    this.refillRate = maxPerMinute / 60000; // tokens per ms
    this.lastRefill = Date.now();
  }

  updateServerRemaining(remaining: number): void {
    this.serverRemaining = remaining;
  }

  async schedule<T>(
    execute: () => Promise<T>,
    priority: Priority = 2
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        addedAt: Date.now(),
      });

      // Sort by priority (lower number = higher priority), then by time added
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.addedAt - b.addedAt;
      });

      this.processQueue();
    });
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  private canProcess(): boolean {
    if (this.serverRemaining !== null && this.serverRemaining < 3) {
      return false;
    }
    this.refillTokens();
    return this.tokens >= 1;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // For background sync (priority 3), pause if server says <5 remaining
      if (
        this.queue[0].priority === 3 &&
        this.serverRemaining !== null &&
        this.serverRemaining < 5
      ) {
        await this.sleep(2000);
        this.serverRemaining = null;
        continue;
      }

      if (!this.canProcess()) {
        const waitTime = Math.ceil(1 / this.refillRate);
        await this.sleep(Math.min(waitTime, 1100));
        continue;
      }

      this.tokens -= 1;
      const request = this.queue.shift()!;

      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get availableTokens(): number {
    this.refillTokens();
    return Math.floor(this.tokens);
  }
}

export const rateLimiter = new RateLimiter(60);

// Wire up the rate limiter reference for the API client
import { setRateLimiterRef } from './client';
setRateLimiterRef(rateLimiter);
