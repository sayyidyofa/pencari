import type { Browser, Page } from 'playwright';
import type { IScraper, Post } from '../core/types';
import { config } from '../config';

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

  async scrape(browser: Browser, patterns: string[]): Promise<Post[]> {
    // Reuse the existing context (where the worker injected the auth cookies)
    // when available, otherwise fall back to a fresh context.
    const existingContext = browser.contexts()[0];
    const context = existingContext ?? (await browser.newContext());
    const ownsContext = existingContext === undefined;
    const page = await context.newPage();

    const query = patterns.join('%20OR%20');
    const targetUrl = `https://x.com/search?q=(${query})%20remote%20(US%20OR%20USA)&f=live`;

    try {
      console.log(`Navigating to ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Give the React app a moment to hydrate, then read like a human.
      await this.delay();
      await this.humanScroll(page, 5);

      return await page.$$eval(
        'article[data-testid="tweet"]',
        (elements) => {
          const parsed: Post[] = [];

          for (const el of elements) {
            try {
              // Tweet textual content.
              let text = '';
              try {
                const textEl = el.querySelector('div[data-testid="tweetText"]');
                text = textEl?.textContent ?? '';
              } catch (innerError) {
                console.error('Error extracting tweet text:', innerError);
              }

              // Tweet permalink + timestamp live inside the <time> anchor.
              let url = '';
              let timestamp = new Date();
              try {
                const timeEl = el.querySelector('time');
                const datetime = timeEl?.getAttribute('datetime');
                if (datetime) {
                  timestamp = new Date(datetime);
                }

                const anchor = timeEl?.closest('a');
                const href = anchor?.getAttribute('href') ?? '';
                if (href) {
                  url = href.startsWith('http') ? href : `https://x.com${href}`;
                }
              } catch (innerError) {
                console.error('Error extracting tweet url/timestamp:', innerError);
              }

              // Derive a stable id from the status URL when available.
              let id = url;
              try {
                const match = url.match(/status\/(\d+)/);
                if (match && match[1]) {
                  id = match[1];
                }
              } catch (innerError) {
                console.error('Error extracting tweet id:', innerError);
              }

              if (!id && !text) {
                continue;
              }

              parsed.push({
                id,
                text,
                url,
                source: 'twitter',
                timestamp,
              });
            } catch (innerError) {
              console.error('Error parsing tweet element:', innerError);
            }
          }

          return parsed;
        }
      );
    } catch (error) {
      console.error('Error in TwitterScraper:', error);
      return [];
    } finally {
      await page.close();
      // Only dispose contexts that we created ourselves to avoid tearing down
      // the shared context that holds the injected session cookies.
      if (ownsContext) {
        await context.close();
      }
    }
  }
}
