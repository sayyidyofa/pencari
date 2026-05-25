import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgresDatabaseProvider } from "./PostgresDatabaseProvider";

describe("PostgresDatabaseProvider Integration Test", () => {
  let container: StartedPostgreSqlContainer;
  let provider: PostgresDatabaseProvider;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:15-alpine").start();
    const url = `postgres://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
    provider = new PostgresDatabaseProvider(url);
  }, 60000);

  afterAll(async () => {
    await provider.disconnect();
    await container.stop();
  });

  it("should execute DDL and DML correctly", async () => {
    // 1. Create table
    await provider.execute(`
      CREATE TABLE test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    `);

    // 2. Insert data
    const testName = "Test Row";
    await provider.execute(
      "INSERT INTO test_table (name) VALUES ($1)",
      [testName]
    );

    // 3. Query data
    interface TestRow {
      id: number;
      name: string;
    }
    const results = await provider.query<TestRow>("SELECT * FROM test_table WHERE name = $1", [testName]);
    
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe(testName);
  });

  it("should handle empty results", async () => {
    const results = await provider.query<{ tablename: string }>("SELECT * FROM pg_tables WHERE tablename = $1", ["non_existent"]);
    expect(results).toHaveLength(0);
  });
});
