// Structural type, decoupled from any concrete database package (DIP).
// Matches what postgres.ParameterOrJSON<number> accepts, but without importing it.
export type QueryParam = string | number | boolean | null | object | Date;

export interface IDatabase {
  query<T extends object>(sql: string, params?: QueryParam[]): Promise<T[]>;
  execute(sql: string, params?: QueryParam[]): Promise<void>;
  disconnect(): Promise<void>;
}
