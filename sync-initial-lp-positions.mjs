// sync-initial-lp-positions.mjs
// One-time script to sync initial LP positions to PostgreSQL

import dotenv from 'dotenv';
import { PoolRepository } from './server/keeta-impl/db/pool-repository.js';
import { initializeDatabase } from './server/keeta-impl/db/client.js';

dotenv.config();

async function main() {
  console.log('🚀 Syncing initial LP positions to PostgreSQL\n');

  try {
    // Initialize database
    await initializeDatabase();

    const repository = new PoolRepository();

    // Your wallet address
    const userAddress = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';

    // KTA/WAVE pool - from current pools endpoint
    const ktaWavePool = 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek';
    const ktaWaveShares = '3162277660';

    console.log(`📦 Adding LP position for KTA/WAVE pool...`);
    await repository.saveLPPosition(ktaWavePool, userAddress, BigInt(ktaWaveShares));
    console.log(`✅ Saved: ${ktaWaveShares} shares in pool ${ktaWavePool}`);

    // RIDE/KTA pool - creator position (you created this pool)
    const rideKtaPool = 'keeta_athjolef2zpnj6pimky2sbwbe6cmtdxakgixsveuck7fd7ql2vrf6mxkh4gy4';

    console.log(`\n📦 Adding LP position for RIDE/KTA pool...`);
    console.log(`   (Creator position - will be calculated from reserves)`);
    // Use 1 as placeholder - actual shares calculated from reserves
    await repository.saveLPPosition(rideKtaPool, userAddress, 1n);
    console.log(`✅ Saved: Creator position for pool ${rideKtaPool}`);

    console.log('\n✅ LP position sync complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
