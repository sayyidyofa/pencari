import { Worker, Job, UnrecoverableError } from 'bullmq';
import { chromium } from 'playwright';
import { config } from '../config';
import IORedis from 'ioredis';
import { DatabaseFactory } from '../core/factories/DatabaseFactory';
import { CacheFactory } from '../core/factories/CacheFactory';
import { PatternRepository } from '../repositories/PatternRepository';
import { TwitterScraper } from '../scrapers/TwitterScraper';
import { FilterService } from '../services/FilterService';
import { NotifierService } from '../services/NotifierService';
import { AuthenticationError, RateLimitError } from '../core/errors';
import type { BrowserContext } from 'playwright';

type PlaywrightCookie = Parameters<BrowserContext['addCookies']>[0][number];

const parseTwitterCookies = (raw: string): PlaywrightCookie[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('TWITTER_COOKIES_JSON is not an array. Ignoring.');
      return [];
    }
    return parsed as PlaywrightCookie[];
  } catch (error) {
    console.error('Failed to parse TWITTER_COOKIES_JSON:', error);
    return [];
  }
};

const connection = new IORedis(config.queue.redisUrl, {
  maxRetriesPerRequest: null,
});

export const startWorker = () => {
  const db = DatabaseFactory.getInstance();
  const cache = CacheFactory.getInstance();
  const patternRepo = new PatternRepository(db);
  
  const filterService = new FilterService(config);
  const notifierService = new NotifierService(config);
  const twitterScraper = new TwitterScraper();

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
        // 2a. Resolve the browser context and inject persisted Twitter session
        //     cookies into it so the scraper bypasses the login wall. The same
        //     context is then passed explicitly to the scraper to avoid any
        //     implicit coupling via contexts() lookup ordering.
        const context = browser.contexts()[0] ?? (await browser.newContext());
        const cookies = parseTwitterCookies(config.scraper.twitterCookiesJson);
        if (cookies.length > 0) {
          await context.addCookies(cookies);
          console.log(`[Job ${job.id}] Injected ${cookies.length} Twitter cookies into the context.`);
        }

        // 3. Instantiate the Scraper and fetch posts
        const posts = await twitterScraper.scrape(context, patterns);
        console.log(`[Job ${job.id}] Scraped ${posts.length} posts from Twitter`);

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
        if (error instanceof RateLimitError) {
          // Move job to a delayed state for the cooldown period instead of
          // hammering the target through BullMQ's fast exponential backoff.
          const delayMs = error.retryAfterMs > 0 ? error.retryAfterMs : 60 * 60 * 1000;
          console.warn(`[Job ${job.id}] Rate limited. Delaying retry by ${delayMs}ms.`);
          await job.moveToDelayed(Date.now() + delayMs);
          return; // Do NOT rethrow — job is already moved.
        }

        if (error instanceof AuthenticationError) {
          // Auth errors are unrecoverable without manual intervention.
          console.error(`[Job ${job.id}] Authentication failed. Marking as unrecoverable.`);
          throw new UnrecoverableError(error.message); // BullMQ will NOT retry.
        }

        console.error(`[Job ${job.id}] Error during job processing:`, error);
        throw error; // Generic errors use standard BullMQ exponential backoff.
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
