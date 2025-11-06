// Create new pools with correct permissions
import { getPoolManager } from './server/keeta-impl/contracts/PoolManager.js';

async function createNewPools() {
  try {
    console.log('🏗️ Creating new pools with correct permissions\n');

    // Token addresses
    const KTA = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
    const WAVE = 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym';
    const RIDE = 'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo';

    // Creator address (your wallet)
    const creatorAddress = process.env.USER_SEED
      ? (await import('./server/keeta-impl/utils/client.js')).createUserClient(process.env.USER_SEED).address
      : 'keeta_aabtozgfunwwvwdztv54y6l5x57q2g3254shgp27zjltr2xz3pyo7q4tjtmsamy';

    console.log(`👤 Creator: ${creatorAddress}\n`);

    const poolManager = await getPoolManager();

    // Create KTA/WAVE pool
    console.log('📊 Creating KTA/WAVE pool...');
    const ktaWavePool = await poolManager.createPool(KTA, WAVE, creatorAddress);
    console.log(`✅ KTA/WAVE pool created: ${ktaWavePool.poolAddress}\n`);

    // Create KTA/RIDE pool
    console.log('📊 Creating KTA/RIDE pool...');
    const ktaRidePool = await poolManager.createPool(KTA, RIDE, creatorAddress);
    console.log(`✅ KTA/RIDE pool created: ${ktaRidePool.poolAddress}\n`);

    console.log('🎉 All pools created successfully!');
    console.log('\nPool Summary:');
    console.log(`  KTA/WAVE: ${ktaWavePool.poolAddress}`);
    console.log(`  KTA/RIDE: ${ktaRidePool.poolAddress}`);
    console.log('\n✅ OPS has SEND_ON_BEHALF permission on both pools');
    console.log('✅ Ready for permissionless swaps!');

  } catch (error) {
    console.error('\n❌ Pool creation failed:');
    console.error('Message:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack.slice(0, 500));
    }
  }
}

createNewPools();
