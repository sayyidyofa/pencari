import Redis from 'ioredis';
import type { ICache } from '../../interfaces/ICache';

export class RedisCacheProvider implements ICache {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url);
    this.client.on('error', (err) => console.error('Redis Client Error', err));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
