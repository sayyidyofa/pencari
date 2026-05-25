import { startWorker } from './src/queue/worker';
import { scheduleScraping } from './src/queue/scheduler';
import { DatabaseFactory } from './src/core/factories/DatabaseFactory';
import { SeederService } from './src/services/SeederService';

async function main() {
  console.log('🚀 Starting Pencari Worker Service...');

  try {
    // 1. Initialize Database and Seed if necessary
    const db = DatabaseFactory.getInstance();
    const seeder = new SeederService(db);
    await seeder.run();

    // 2. Start BullMQ Worker
    startWorker();

    // 3. Schedule Repeatable Jobs
    await scheduleScraping();

    console.log('✅ Pencari Worker is up and running.');
  } catch (error) {
    console.error('❌ Failed to start Pencari Worker:', error);
    process.exit(1);
  }
}

main();
