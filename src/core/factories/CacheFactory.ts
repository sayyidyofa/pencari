import type { ICache } from '../interfaces/ICache';
import { RedisCacheProvider } from '../providers/cache/RedisCacheProvider';
import { config } from '../../config';

export class CacheFactory {
  private static instance: ICache | undefined = undefined;

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

  /** For testing: allows resetting the singleton between test cases */
  public static reset(): void {
    CacheFactory.instance = undefined;
  }
}
