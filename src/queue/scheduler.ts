import { scrapeQueue } from './queue';

export const scheduleScraping = async () => {
  const jobName = 'scrape_job';
  
  // Remove existing repeatable jobs to avoid duplicates during development
  const repeatableJobs = await scrapeQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === jobName) {
      await scrapeQueue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule every 5 minutes (mock cron)
  await scrapeQueue.add(
    jobName,
    {},
    {
      repeat: {
        pattern: '*/5 * * * *',
      },
    }
  );

  console.log('Scraping job scheduled for every 5 minutes.');
};
