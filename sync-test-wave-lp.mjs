// sync-test-wave-lp.mjs
// Sync TEST/WAVE pool LP position to PostgreSQL database

import dotenv from 'dotenv';
import { PoolRepository } from './server/keeta-impl/db/pool-repository.js';
import { initializeDatabase } from './server/keeta-impl/db/client.js';

dotenv.config();

async function main() {
  console.log('🔄 Syncing TEST/WAVE LP Position to PostgreSQL\n');

  try {
    // Don't initialize schema - database already exists
    // Just connect to the existing database
    const repository = new PoolRepository();

    // TEST/WAVE pool details
    const poolAddress = 'keeta_aqvpd2ear7kby3pjpkvxrkurxk7z2kfv25mcyuqudvzd5xpcz5psup34qnss4';
    const ownerAddress = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';

    // From the /api/pools endpoint, we know the reserves
    const reserveA = '5123628000000'; // TEST
    const reserveB = '14638065058588'; // WAVE

    // Calculate shares using sqrt(reserveA * reserveB)
    // This is the standard initial LP share calculation
    const reserveAParsed = BigInt(reserveA);
    const reserveBParsed = BigInt(reserveB);

    // Calculate sqrt(a * b)
    const product = reserveAParsed * reserveBParsed;
    const shares = sqrt(product);

    console.log(`📦 Pool: ${poolAddress}`);
    console.log(`👤 Owner: ${ownerAddress}`);
    console.log(`💰 Reserve A (TEST): ${reserveA}`);
    console.log(`💰 Reserve B (WAVE): ${reserveB}`);
    console.log(`🎯 Calculated shares: ${shares.toString()}\n`);

    // Save to database
    await repository.saveLPPosition(poolAddress, ownerAddress, shares);

    console.log('✅ LP position synced to database!');
    console.log(`   You should now see the TEST/WAVE pool in your Portfolio\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Integer square root using Newton's method
function sqrt(value) {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }
  if (value < 2n) {
    return value;
  }

  // Initial guess
  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
}

main();
