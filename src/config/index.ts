export const config = {
  db: {
    provider: process.env.DB_PROVIDER || 'POSTGRES',
    url: process.env.DB_URL || 'postgresql://user:password@localhost:5432/pencari',
  },
  cache: {
    provider: process.env.CACHE_PROVIDER || 'REDIS',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  browser: {
    wsEndpoint: process.env.BROWSER_WS_ENDPOINT || 'ws://localhost:3000',
  },
  queue: {
    name: 'scrape_job',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  },
};

export type Config = typeof config;
