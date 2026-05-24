import type { IDatabase } from '../interfaces/IDatabase';
import { PostgresDatabaseProvider } from '../providers/database/PostgresDatabaseProvider';
import { config } from '../../config';

export class DatabaseFactory {
  private static instance: IDatabase;

  private constructor() {}

  public static getInstance(): IDatabase {
    if (!DatabaseFactory.instance) {
      if (config.db.provider === 'POSTGRES') {
        DatabaseFactory.instance = new PostgresDatabaseProvider(config.db.url);
      } else {
        throw new Error(`Unsupported database provider: ${config.db.provider}`);
      }
    }
    return DatabaseFactory.instance;
  }
}
