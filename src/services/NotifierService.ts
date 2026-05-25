import { config } from '../config';
import type { Post } from '../core/types';

export class NotifierService {
  /**
   * Sends an alert to a Discord or Telegram webhook.
   */
  async sendAlert(post: Post): Promise<void> {
    if (!config.notifier.webhookUrl) {
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

    try {
      const response = await fetch(config.notifier.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }

      console.log(`Successfully sent alert for post: ${post.id}`);
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }
}
