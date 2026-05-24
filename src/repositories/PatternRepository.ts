import type { IDatabase } from '../core/interfaces/IDatabase';

export class PatternRepository {
  constructor(private db: IDatabase) {}

  async getSearchPatterns(): Promise<string[]> {
    const results = await this.db.query<{ pattern: string }>(
      'SELECT pattern FROM search_patterns'
    );
    return results.map((r) => r.pattern);
  }
}
