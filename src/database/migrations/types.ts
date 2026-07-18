export type MigrationDatabase = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
};

export type DatabaseMigration = {
  id: string;
  up: (database: MigrationDatabase) => Promise<void>;
};
