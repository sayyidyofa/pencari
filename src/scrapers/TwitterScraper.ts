import type { BrowserContext, Page } from 'playwright';
import type { IScraper, Post } from '../core/types';
import { config } from '../config';
import { AuthenticationError, RateLimitError } from '../core/errors';

interface RawTweetData {
  id: string;
  text: string;
  url: string;
  timestampIso: string | null;
}

export class TwitterScraper implements IScraper {
  /**
   * Sleep for a random amount of time between the provided bounds to mimic
   * human reaction/reading delays. Falls back to the jitter values from config.
   */
  private async delay(
    min: number = config.scraper.humanJitterMinMs,
    max: number = config.scraper.humanJitterMaxMs
  ): Promise<void> {
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    const ms = lower + Math.random() * (upper - lower);
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Scroll the page down in random pixel increments, pausing between each
   * scroll to simulate a human reading the timeline.
   */
  private async humanScroll(page: Page, targetScrolls: number): Promise<void> {
    for (let i = 0; i < targetScrolls; i++) {
      const distance = 300 + Math.floor(Math.random() * 300); // 300px - 600px
      try {
        await page.mouse.wheel(0, distance);
      } catch (error) {
        console.error('Error during humanScroll scroll:', error);
      }
      await this.delay();
    }
  }

  async scrape(context: BrowserContext, patterns: string[]): Promise<Post[]> {
    // The context already carries the auth cookies injected by the worker.
    const page = await context.newPage();

    try {
      const targetUrl = this.buildSearchUrl(patterns);
      console.log(`Navigating to ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Guard methods throw typed errors (auth/rate-limit) that propagate to the
      // worker. They live outside any swallowing catch, so there is no need to
      // re-check `instanceof` and rethrow them afterwards.
      await this.assertNotBlocked(page);

      // Give the React app a moment to hydrate, then read like a human.
      await this.delay();
      await this.humanScroll(page, 5);

      return await this.extractPosts(page);
    } finally {
      await page.close();
    }
  }

  /**
   * Build the targeted "live" Twitter search URL from the keyword patterns.
   */
  private buildSearchUrl(patterns: string[]): string {
    const query = patterns.join('%20OR%20');
    return `https://x.com/search?q=(${query})%20remote%20(US%20OR%20USA)&f=live`;
  }

  /**
   * Detect auth/rate-limit failures and surface them as typed errors so the
   * worker can apply the right retry strategy instead of silently retrying.
   */
  private async assertNotBlocked(page: Page): Promise<void> {
    if (/\/(login|i\/flow\/login)/.test(page.url())) {
      throw new AuthenticationError('Redirected to Twitter login wall (session expired).');
    }

    const bodyText = (await page.textContent('body')) ?? '';
    if (/rate limit exceeded|try again later/i.test(bodyText)) {
      throw new RateLimitError(60 * 60 * 1000, 'Twitter rate limit reached.');
    }
  }

  /**
   * Parse the tweet DOM into Post objects. DOM parsing is best-effort: a broken
   * selector should yield an empty result rather than crashing the scrape.
   */
  private async extractPosts(page: Page): Promise<Post[]> {
    try {
      const rawPosts: RawTweetData[] = await page.$$eval(
        'article[data-testid="tweet"]',
        (elements): RawTweetData[] => {
          const parsed: RawTweetData[] = [];

          for (const el of elements) {
            const textEl = el.querySelector('div[data-testid="tweetText"]');
            const text = textEl?.textContent?.trim() ?? '';

            const timeEl = el.querySelector('time');
            const timestampIso = timeEl?.getAttribute('datetime') ?? null;

            const href = timeEl?.closest('a')?.getAttribute('href') ?? '';
            const url = href ? (href.startsWith('http') ? href : `https://x.com${href}`) : '';

            const idMatch = url.match(/status\/(\d+)/);
            const id = idMatch?.[1] ?? url;

            if (!id && !text) continue;
            parsed.push({ id, text, url, timestampIso });
          }

          return parsed;
        }
      );

      // Hydrate Date instances in the Node.js context (Playwright serializes the
      // $$eval return value via JSON, so Dates must be re-created here).
      return rawPosts.map((raw): Post => ({
        id: raw.id,
        text: raw.text,
        url: raw.url,
        source: 'twitter',
        timestamp: raw.timestampIso ? new Date(raw.timestampIso) : new Date(),
      }));
    } catch (error) {
      console.error('Error parsing tweets in TwitterScraper:', error);
      return [];
    }
  }
}
