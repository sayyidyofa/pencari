import type { BrowserContext } from 'playwright';

export interface Post {
  id: string;
  text: string;
  url: string;
  source: 'twitter' | 'reddit';
  timestamp: Date;
}

export interface IScraper {
  scrape(context: BrowserContext, patterns: string[]): Promise<Post[]>;
}
