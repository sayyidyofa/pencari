import { Queue } from 'bullmq';
import { config } from '../config';
import IORedis from 'ioredis';

// Exported so index.ts can close it during graceful shutdown.
export const queueConnection = new IORedis(config.queue.redisUrl, {
  maxRetriesPerRequest: null,
});

export const scrapeQueue = new Queue(config.queue.name, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});
