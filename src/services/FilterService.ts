import type { Config } from '../config';

export class FilterService {
  constructor(private readonly config: Pick<Config, 'llm'>) {}

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
    if (!this.config.llm.apiKey || !this.config.llm.endpoint) {
      console.warn('LLM configuration missing, skipping AI evaluation.');
      return true; // Fallback to true if LLM is not configured, to not miss potential leads
    }

    try {
      const result = await this.requestEvaluation(text);
      console.log(`LLM Evaluation result for "${text.substring(0, 30)}...":`, result);
      return result.is_job_posting;
    } catch (error) {
      console.error('Error in LLM evaluation:', error);
      return false; // Fail safe by returning false on error
    }
  }

  /**
   * Performs the OpenAI-compatible chat completion request and parses the
   * structured result. Validation failures throw naturally and are handled by
   * the fail-safe catch in {@link evaluateIntent}, keeping the request/parse
   * logic separate from the error-swallowing boundary.
   */
  private async requestEvaluation(
    text: string,
  ): Promise<{ is_job_posting: boolean; match_score: number }> {
    const response = await fetch(this.config.llm.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.llm.model ?? 'gpt-4o-mini',
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

    const rawResult: unknown = JSON.parse(content);

    // Runtime shape validation — fail loudly if the LLM schema drifts. The throw
    // is caught by the fail-safe boundary in evaluateIntent(), keeping it logged.
    if (
      typeof rawResult !== 'object' ||
      rawResult === null ||
      !('is_job_posting' in rawResult) ||
      typeof (rawResult as Record<string, unknown>)['is_job_posting'] !== 'boolean'
    ) {
      throw new Error(
        `LLM returned unexpected shape: ${JSON.stringify(rawResult).substring(0, 100)}`,
      );
    }

    return rawResult as { is_job_posting: boolean; match_score: number };
  }
}
