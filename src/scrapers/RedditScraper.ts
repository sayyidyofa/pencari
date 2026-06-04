import type { BrowserContext, Page } from 'playwright';
import type { IScraper, Post } from '../core/types';

interface RawRedditData {
  id: string;
  text: string;
  url: string;
  timestampIso: string | null;
}

export class RedditScraper implements IScraper {
  private readonly targetUrl = 'https://old.reddit.com/r/startups/new/';

  async scrape(context: BrowserContext, _patterns: string[]): Promise<Post[]> {
    const page = await context.newPage();

    try {
      console.log(`Navigating to ${this.targetUrl}`);
      // Use a timeout and wait until DOM is loaded
      await page.goto(this.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Random delay to respect the platform (1-3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

      return await this.extractPosts(page);
    } finally {
      await page.close(); // only close the page we created; caller owns the context
    }
  }

  /**
   * Parse the listing DOM into Post objects. DOM parsing is best-effort: a
   * broken selector should yield an empty result rather than crashing the scrape.
   */
  private async extractPosts(page: Page): Promise<Post[]> {
    try {
      const rawPosts: RawRedditData[] = await page.$$eval(
        '.thing',
        (elements): RawRedditData[] => {
          return elements.map((el) => {
            const id = el.getAttribute('data-fullname') ?? '';
            const titleEl = el.querySelector('a.title');
            const text = titleEl?.textContent ?? '';
            const url = titleEl?.getAttribute('href') ?? '';

            // Construct absolute URL if it's relative
            const absoluteUrl = url.startsWith('/') ? `https://old.reddit.com${url}` : url;

            const timeEl = el.querySelector('time');
            const timestampIso = timeEl?.getAttribute('datetime') ?? null;

            return { id, text, url: absoluteUrl, timestampIso };
          });
        }
      );

      // Hydrate Date instances in the Node.js context (Playwright serializes the
      // $$eval return value via JSON, so Dates must be re-created here).
      return rawPosts.map((raw): Post => ({
        id: raw.id,
        text: raw.text,
        url: raw.url,
        source: 'reddit',
        timestamp: raw.timestampIso ? new Date(raw.timestampIso) : new Date(),
      }));
    } catch (error) {
      console.error('Error parsing posts in RedditScraper:', error);
      return [];
    }
  }
}
