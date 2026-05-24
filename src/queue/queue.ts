import { Queue } from 'bullmq';
import { config } from '../config';
import IORedis from 'ioredis';

const connection = new IORedis(config.queue.redisUrl, {
  maxRetriesPerRequest: null,
});

export const scrapeQueue = new Queue(config.queue.name, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});
