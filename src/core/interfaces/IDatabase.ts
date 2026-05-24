export interface IDatabase {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  disconnect(): Promise<void>;
}
