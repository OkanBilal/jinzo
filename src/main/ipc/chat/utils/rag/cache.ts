import { createHash } from "crypto";
import { CacheEntry, CacheStats } from "../rag";
import { CACHE_DEFAULTS } from "../../config";

function minutesToMilliseconds(minutes: number): number {
  return minutes * 60 * 1000;
}

function generateHashKey(input: any): string {
  const str = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha256").update(str).digest("hex");
}

function isExpired<T>(entry: CacheEntry<T>, ttl: number): boolean {
  return Date.now() - entry.timestamp > ttl;
}
class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;
  private hitCount = 0;
  private missCount = 0;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(maxSize = 100, ttlMinutes = 60) {
    this.maxSize = maxSize;
    this.ttl = minutesToMilliseconds(ttlMinutes);

    this.cleanupInterval = setInterval(
      () => {
        this.pruneExpired();
      },
      5 * 60 * 1000
    );
  }

  set(key: any, data: T): void {
    const cacheKey = generateHashKey(key);

    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  get(key: any): T | null {
    const cacheKey = generateHashKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.missCount++;
      return null;
    }

    if (isExpired(entry, this.ttl)) {
      this.cache.delete(cacheKey);
      this.missCount++;
      return null;
    }

    entry.hits++;
    this.hitCount++;
    return entry.data;
  }

  private evictLRU(): void {
    const entries = [...this.cache.entries()];

    const staleEntries = entries.filter(
      ([_, entry]) =>
        Date.now() - entry.timestamp > 60 * 60 * 1000 && entry.hits === 0
    );

    if (staleEntries.length > 0) {
      const [key] = staleEntries[0];
      this.cache.delete(key);
      return;
    }

    const scored = entries.map(([key, entry]) => ({
      key,
      score: entry.hits / Math.max(1, (Date.now() - entry.timestamp) / 1000),
    }));

    scored.sort((a, b) => a.score - b.score);
    this.cache.delete(scored[0].key);
  }

  pruneExpired(): number {
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (isExpired(entry, this.ttl)) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }

  setMany(entries: Array<[any, T]>): void {
    entries.forEach(([key, data]) => this.set(key, data));
  }

  getMany(keys: any[]): Map<any, T | null> {
    const results = new Map();
    keys.forEach((key) => {
      results.set(key, this.get(key));
    });
    return results;
  }

  async getOrSet(key: any, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const data = await factory();
    this.set(key, data);
    return data;
  }

  async warmup(entries: Array<[any, T]>): Promise<void> {
    entries.forEach(([key, data]) => this.set(key, data));
  }

  size(): number {
    return this.cache.size;
  }

  hitRatio(): number {
    const total = this.hitCount + this.missCount;
    return total === 0 ? 0 : this.hitCount / total;
  }

  stats(): CacheStats & {
    hitCount: number;
    missCount: number;
    hitRatio: number;
  } {
    return {
      size: this.cache.size,
      entries: [...this.cache.entries()]
        .map(([key, entry]) => ({
          key: key.slice(0, 8),
          hits: entry.hits,
          age: Math.floor((Date.now() - entry.timestamp) / 1000),
        }))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10),
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio: this.hitRatio(),
    };
  }
}

const embeddingCache = new SimpleCache<number[]>(
  CACHE_DEFAULTS.EMBEDDING_MAX_SIZE,
  CACHE_DEFAULTS.EMBEDDING_TTL_MINUTES
);

const responseCache = new SimpleCache<string>(
  CACHE_DEFAULTS.RESPONSE_MAX_SIZE,
  CACHE_DEFAULTS.RESPONSE_TTL_MINUTES
);

async function cachedEmbedding(
  text: string,
  generateFn: (text: string) => Promise<number[]>
): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) {
    console.log("✓ Embedding cache hit");
    return cached;
  }

  const embedding = await generateFn(text);
  embeddingCache.set(text, embedding);
  return embedding;
}

export { cachedEmbedding, embeddingCache, responseCache };
