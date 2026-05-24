import type { ICache } from '../interfaces/ICache';
import { RedisCacheProvider } from '../providers/cache/RedisCacheProvider';
import { config } from '../../config';

export class CacheFactory {
  private static instance: ICache;

  private constructor() {}

  public static getInstance(): ICache {
    if (!CacheFactory.instance) {
      if (config.cache.provider === 'REDIS') {
        CacheFactory.instance = new RedisCacheProvider(config.cache.url);
      } else {
        throw new Error(`Unsupported cache provider: ${config.cache.provider}`);
      }
    }
    return CacheFactory.instance;
  }
}
