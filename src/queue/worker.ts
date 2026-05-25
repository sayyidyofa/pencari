import { Worker, Job } from 'bullmq';
import { chromium } from 'playwright';
import { config } from '../config';
import IORedis from 'ioredis';
import { DatabaseFactory } from '../core/factories/DatabaseFactory';
import { CacheFactory } from '../core/factories/CacheFactory';
import { PatternRepository } from '../repositories/PatternRepository';
import { RedditScraper } from '../scrapers/RedditScraper';
import { FilterService } from '../services/FilterService';
import { NotifierService } from '../services/NotifierService';

const connection = new IORedis(config.queue.redisUrl, {
  maxRetriesPerRequest: null,
});

export const startWorker = () => {
  const db = DatabaseFactory.getInstance();
  const cache = CacheFactory.getInstance();
  const patternRepo = new PatternRepository(db);
  
  const filterService = new FilterService();
  const notifierService = new NotifierService();
  const redditScraper = new RedditScraper();

  const worker = new Worker(
    config.queue.name,
    async (job: Job) => {
      console.log(`[Job ${job.id}] Starting scraping task: ${job.name}`);
      
      // 1. Fetch patterns from the PatternRepository
      const patterns = await patternRepo.getSearchPatterns();
      console.log(`[Job ${job.id}] Patterns: ${patterns.join(', ')}`);

      // 2. Connect to the CDP browser instance
      const browser = await chromium.connectOverCDP(config.browser.wsEndpoint);
      
      try {
        // 3. Instantiate the Scraper and fetch posts
        const posts = await redditScraper.scrape(browser, patterns);
        console.log(`[Job ${job.id}] Scraped ${posts.length} posts from Reddit`);

        for (const post of posts) {
          // 4. Deduplication: Check if its id exists in the ICache (Redis)
          const cacheKey = `processed_post:${post.id}`;
          const alreadyProcessed = await cache.get(cacheKey);

          if (alreadyProcessed) {
            console.log(`[Job ${job.id}] Skipping already processed post: ${post.id}`);
            continue;
          }

          // 5. Filtering: Pass it through FilterService.passesRegex()
          const matchesKeywords = filterService.passesRegex(post.text, patterns);
          if (!matchesKeywords) {
            console.log(`[Job ${job.id}] Post ${post.id} did not match keywords. Skipping.`);
            continue;
          }

          // 6. AI Evaluation: Pass it to FilterService.evaluateIntent()
          console.log(`[Job ${job.id}] Evaluating intent for post ${post.id}...`);
          const isRelevantJob = await filterService.evaluateIntent(post.text);
          
          if (!isRelevantJob) {
            console.log(`[Job ${job.id}] Post ${post.id} failed AI evaluation. Skipping.`);
            continue;
          }

          // 7. Alerting: If the AI evaluates it as a real job posting, send alert
          await notifierService.sendAlert(post);

          // 8. State Update: Save post id to ICache with a TTL of 7 days
          const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;
          await cache.set(cacheKey, 'true', SEVEN_DAYS_IN_SECONDS);
          console.log(`[Job ${job.id}] Successfully processed and alerted for post ${post.id}`);
        }

      } catch (error) {
        console.error(`[Job ${job.id}] Error during job processing:`, error);
        throw error; // Let BullMQ handle retries
      } finally {
        // 9. Close the browser connection gracefully
        await browser.close();
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log('Pencari Worker started and waiting for jobs...');
  return worker;
};
