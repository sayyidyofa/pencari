import type { Browser } from 'playwright';
import type { IScraper, Post } from '../core/types';

export class RedditScraper implements IScraper {
  private readonly targetUrl = 'https://old.reddit.com/r/startups/new/';

  async scrape(browser: Browser, _patterns: string[]): Promise<Post[]> {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log(`Navigating to ${this.targetUrl}`);
      // Use a timeout and wait until DOM is loaded
      await page.goto(this.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Random delay to respect the platform (1-3 seconds)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const posts: Post[] = await page.$$eval('.thing', (elements) => {
        return elements.map(el => {
          const id = el.getAttribute('data-fullname') || '';
          const titleEl = el.querySelector('a.title');
          const text = titleEl?.textContent || '';
          const url = titleEl?.getAttribute('href') || '';
          
          // Construct absolute URL if it's relative
          const absoluteUrl = url.startsWith('/') ? `https://old.reddit.com${url}` : url;

          const timeEl = el.querySelector('time');
          const timestamp = timeEl ? new Date(timeEl.getAttribute('datetime') || Date.now()) : new Date();

          return {
            id,
            text,
            url: absoluteUrl,
            source: 'reddit',
            timestamp
          };
        });
      });

      return posts;
    } catch (error) {
      console.error('Error in RedditScraper:', error);
      return [];
    } finally {
      await context.close();
    }
  }
}
