import { startWorker } from './src/queue/worker';
import { scheduleScraping } from './src/queue/scheduler';

async function main() {
  console.log('🚀 Starting Pencari Worker Service...');

  try {
    // Start BullMQ Worker
    startWorker();

    // Schedule Repeatable Jobs
    await scheduleScraping();

    console.log('✅ Pencari Worker is up and running.');
  } catch (error) {
    console.error('❌ Failed to start Pencari Worker:', error);
    process.exit(1);
  }
}

main();
