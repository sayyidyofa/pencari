import { scrapeQueue } from './queue';
import { config } from '../config';

export const scheduleScraping = async () => {
  const jobName = 'scrape_job';
  
  // Remove existing repeatable jobs to avoid duplicates during development
  const repeatableJobs = await scrapeQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === jobName) {
      await scrapeQueue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule using the configurable cron interval to respect rate limits
  await scrapeQueue.add(
    jobName,
    {},
    {
      repeat: {
        pattern: config.scraper.cronInterval,
      },
    }
  );

  console.log(`Scraping job scheduled with cron pattern: ${config.scraper.cronInterval}`);
};
