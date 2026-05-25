import { config } from '../config';

export class FilterService {
  /**
   * Heuristic Filter: Ensures the text contains at least one of the target keywords.
   */
  passesRegex(text: string, patterns: string[]): boolean {
    if (patterns.length === 0) return true;
    
    // Create a case-insensitive regex from patterns
    // Escape patterns to be safe if they contain special characters
    const escapedPatterns = patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(escapedPatterns.join('|'), 'i');
    
    return regex.test(text);
  }

  /**
   * LLM Evaluator: Evaluates the intent of the post using an OpenAI-compatible endpoint.
   */
  async evaluateIntent(text: string): Promise<boolean> {
    if (!config.llm.apiKey || !config.llm.endpoint) {
      console.warn('LLM configuration missing, skipping AI evaluation.');
      return true; // Fallback to true if LLM is not configured, to not miss potential leads
    }

    try {
      const response = await fetch(config.llm.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.llm.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert job market analyst. Your task is to identify if a social media post is a legitimate job posting or a hiring announcement (where someone IS OFFERING a job). Return a JSON object: {"is_job_posting": boolean, "match_score": number}. Set is_job_posting to false if the user is looking for a job (hiring themselves).'
            },
            {
              role: 'user',
              content: `Analyze this post: "${text}"`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('LLM returned empty content');
      }

      const result = JSON.parse(content) as { is_job_posting: boolean; match_score: number };
      console.log(`LLM Evaluation result for "${text.substring(0, 30)}...":`, result);
      
      return !!result.is_job_posting;
    } catch (error) {
      console.error('Error in LLM evaluation:', error);
      return false; // Fail safe by returning false on error
    }
  }
}
