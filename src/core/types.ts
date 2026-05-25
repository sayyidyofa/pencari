import type { Browser } from 'playwright';

export interface Post {
  id: string;
  text: string;
  url: string;
  source: string;
  timestamp: Date;
}

export interface IScraper {
  scrape(browser: Browser, patterns: string[]): Promise<Post[]>;
}
