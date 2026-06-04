import postgres from 'postgres';
import type { IDatabase, QueryParam } from '../../interfaces/IDatabase';

export class PostgresDatabaseProvider implements IDatabase {
  private sql: postgres.Sql;

  constructor(url: string) {
    this.sql = postgres(url, { max: 10 });
  }

  async query<T extends object>(sql: string, params: QueryParam[] = []): Promise<T[]> {
    return this.sql.unsafe<T[]>(sql, params);
  }

  async execute(sql: string, params: QueryParam[] = []): Promise<void> {
    await this.sql.unsafe(sql, params);
  }

  async disconnect(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
