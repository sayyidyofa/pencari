import type { IDatabase } from '../interfaces/IDatabase';
import { PostgresDatabaseProvider } from '../providers/database/PostgresDatabaseProvider';
import { config } from '../../config';

export class DatabaseFactory {
  private static instance: IDatabase | undefined = undefined;

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

  /** For testing: allows resetting the singleton between test cases */
  public static reset(): void {
    DatabaseFactory.instance = undefined;
  }
}
