import type { Config } from '../config';
import type { Post } from '../core/types';

export class NotifierService {
  constructor(private readonly config: Pick<Config, 'notifier'>) {}

  /**
   * Sends an alert to a Discord or Telegram webhook.
   */
  async sendAlert(post: Post): Promise<void> {
    if (!this.config.notifier.webhookUrl) {
      console.warn('Webhook URL not configured, skipping alert.');
      console.log(`[ALERT SIMULATION] Source: ${post.source} | Title: ${post.text} | URL: ${post.url}`);
      return;
    }

    const message = {
      content: `🚀 **New Job Posting Found!**\n\n` +
               `**Source:** \`${post.source.toUpperCase()}\`\n` +
               `**Title:** ${post.text}\n` +
               `**Link:** ${post.url}\n` +
               `**Time:** ${post.timestamp.toLocaleString()}`,
    };

    const response = await fetch(this.config.notifier.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      // Propagate the failure so the caller (worker.ts) does NOT write to cache.
      // The post will be retried on the next job run rather than silently lost.
      throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
    }

    console.log(`Successfully sent alert for post: ${post.id}`);
  }
}
