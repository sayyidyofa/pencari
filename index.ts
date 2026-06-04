import { startWorker } from './src/queue/worker';
import { scheduleScraping } from './src/queue/scheduler';
import { scrapeQueue, queueConnection } from './src/queue/queue';
import { DatabaseFactory } from './src/core/factories/DatabaseFactory';
import { CacheFactory } from './src/core/factories/CacheFactory';
import { SeederService } from './src/services/SeederService';
import { config } from './src/config';

async function main() {
  console.log('🚀 Starting Pencari Worker Service...');

  // 1. Initialize Database and Seed if necessary
  const db = DatabaseFactory.getInstance();
  const cache = CacheFactory.getInstance();
  const seeder = new SeederService(db, config);
  await seeder.run();

  // 2. Start BullMQ Worker
  const worker = startWorker();

  // 3. Schedule Repeatable Jobs
  await scheduleScraping();

  console.log('✅ Pencari Worker is up and running.');

  // 4. Graceful shutdown for Kubernetes SIGTERM / Docker stop.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);
    try {
      await worker.close();   // drain in-flight BullMQ jobs
      await scrapeQueue.close(); // drain the queue
      await queueConnection.quit(); // close the queue's Redis connection
      await db.disconnect();  // close Postgres pool
      await cache.disconnect(); // close Redis client
      console.log('✅ Shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('❌ Failed to start Pencari Worker:', error);
  process.exit(1);
});
