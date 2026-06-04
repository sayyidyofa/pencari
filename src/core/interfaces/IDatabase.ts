import type postgres from 'postgres';

export type QueryParam = postgres.ParameterOrJSON<number>;

export interface IDatabase {
  query<T extends object>(sql: string, params?: QueryParam[]): Promise<T[]>;
  execute(sql: string, params?: QueryParam[]): Promise<void>;
  disconnect(): Promise<void>;
}
