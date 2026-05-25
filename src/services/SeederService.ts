import type { IDatabase } from '../core/interfaces/IDatabase';
import { config } from '../config';

export class SeederService {
  private readonly curatedPatterns = [
    'founding engineer',
    'technical co-founder',
    'first engineer',
    'hiring devops',
    'platform engineer',
    'remote kubernetes',
    'startup hiring',
    'seed stage remote',
    'YC hiring',
    'who is hiring',
  ];

  constructor(private db: IDatabase) {}

  async run(): Promise<void> {
    if (!config.db.seedPatterns) {
      console.log('Seeding is disabled. Skipping...');
      return;
    }

    console.log('🌱 Starting database seeding...');

    try {
      // 1. Create table if not exists
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS search_patterns (
          id SERIAL PRIMARY KEY,
          pattern VARCHAR(255) UNIQUE NOT NULL
        )
      `);

      // 2. Insert curated patterns
      for (const pattern of this.curatedPatterns) {
        await this.db.execute(
          'INSERT INTO search_patterns (pattern) VALUES ($1) ON CONFLICT (pattern) DO NOTHING',
          [pattern]
        );
      }

      console.log('✅ Seeding complete.');
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      throw error;
    }
  }
}
