import { Worker, Job } from 'bullmq';
import { chromium } from 'playwright';
import { config } from '../config';
import IORedis from 'ioredis';
import { DatabaseFactory } from '../core/factories/DatabaseFactory';
import { PatternRepository } from '../repositories/PatternRepository';

const connection = new IORedis(config.queue.redisUrl, {
  maxRetriesPerRequest: null,
});

export const startWorker = () => {
  const db = DatabaseFactory.getInstance();
  const patternRepo = new PatternRepository(db);

  const worker = new Worker(
    config.queue.name,
    async (job: Job) => {
      console.log(`Processing job ${job.id}: ${job.name}`);
      
      // 1. Fetch patterns from DB
      const patterns = await patternRepo.getSearchPatterns();
      console.log(`Using patterns: ${patterns.join(', ')}`);

      // 2. Connect to remote browser
      const browser = await chromium.connectOverCDP(config.browser.wsEndpoint);
      
      try {
        const context = await browser.newContext();
        const page = await context.newPage();

        // 3. Navigate to dummy URL
        const targetUrl = 'https://example.com';
        await page.goto(targetUrl);
        const title = await page.title();
        
        console.log(`Page title: ${title}`);
        console.log(`Successfully processed scraping for patterns on ${targetUrl}`);

        await context.close();
      } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
      } finally {
        await browser.close();
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log('Worker started and waiting for jobs...');
  return worker;
};
