import postgres from 'postgres';
import type { IDatabase } from '../../interfaces/IDatabase';

export class PostgresDatabaseProvider implements IDatabase {
  private sql: postgres.Sql;

  constructor(url: string) {
    this.sql = postgres(url);
  }

  async query<T extends object>(sql: string, params?: unknown[]): Promise<T[]> {
    const results = await this.sql.unsafe(sql, (params || []) as never[]);
    return results as unknown as T[];
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    await this.sql.unsafe(sql, (params || []) as never[]);
  }

  async disconnect(): Promise<void> {
    await this.sql.end();
  }
}
