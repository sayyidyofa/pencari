export const config = {
  db: {
    provider: process.env.DB_PROVIDER || 'POSTGRES',
    url: process.env.DB_URL || 'postgresql://user:password@localhost:5432/pencari',
    seedPatterns: process.env.SEED_PATTERNS === 'true',
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
  llm: {
    endpoint: process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.LLM_API_KEY || '',
  },
  notifier: {
    webhookUrl: process.env.WEBHOOK_URL || '',
  },
};

export type Config = typeof config;
