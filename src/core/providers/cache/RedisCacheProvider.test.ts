import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { RedisCacheProvider } from "./RedisCacheProvider";

describe("RedisCacheProvider Integration Test", () => {
  let container: StartedRedisContainer;
  let provider: RedisCacheProvider;

  beforeAll(async () => {
    container = await new RedisContainer("redis:alpine").start();
    const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    provider = new RedisCacheProvider(url);
  }, 60000);

  afterAll(async () => {
    await provider.disconnect();
    await container.stop();
  });

  it("should set and get a value", async () => {
    const key = "test-key";
    const value = "test-value";
    
    await provider.set(key, value);
    const result = await provider.get(key);
    
    expect(result).toBe(value);
  });

  it("should return null for non-existent key", async () => {
    const result = await provider.get("non-existent");
    expect(result).toBeNull();
  });

  it("should respect TTL", async () => {
    const key = "ttl-key";
    const value = "ttl-value";
    
    await provider.set(key, value, 1); // 1 second TTL
    
    const immediateResult = await provider.get(key);
    expect(immediateResult).toBe(value);
    
    // Wait for 1.1 seconds
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const expiredResult = await provider.get(key);
    expect(expiredResult).toBeNull();
  });
});
