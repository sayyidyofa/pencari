export interface IDatabase {
  query<T extends object>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  disconnect(): Promise<void>;
}
