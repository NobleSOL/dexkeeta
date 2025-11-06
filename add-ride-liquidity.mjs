// Add small liquidity to KTA/RIDE pool
import { createUserClient } from './server/keeta-impl/utils/client.js';
import { getPoolManager } from './server/keeta-impl/contracts/PoolManager.js';

async function addRideLiquidity() {
  try {
    console.log('💧 Adding liquidity to KTA/RIDE pool\n');

    // User's wallet
    const userSeed = process.env.USER_SEED || '617B6CAA5B160ACEFA0A97F6574DE27EC1745E0F04C91A7B31C61DC289649620';
    const { client: userClient, address: userAddress } = createUserClient(userSeed);

    console.log(`👤 User: ${userAddress}\n`);

    // Token addresses
    const KTA = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
    const RIDE = 'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo';

    const poolManager = await getPoolManager();
    const pool = poolManager.getPool(KTA, RIDE);

    if (!pool) {
      throw new Error('KTA/RIDE pool not found!');
    }

    console.log(`📊 Pool address: ${pool.poolAddress}\n`);

    // 1 KTA = 1 * 10^9 atomic units (KTA has 9 decimals)
    // 100,000 RIDE = 100000 * 10^5 = 10000000000 atomic units (RIDE has 5 decimals)
    const ktaAmount = 1000000000n; // 1 KTA
    const rideAmount = 10000000000n; // 100,000 RIDE

    console.log('💧 Adding liquidity:');
    console.log(`   1 KTA (${ktaAmount} atomic units)`);
    console.log(`   100,000 RIDE (${rideAmount} atomic units)\n`);

    await poolManager.addLiquidity(
      userClient,
      userAddress,
      KTA,
      RIDE,
      ktaAmount,
      rideAmount,
      0n, // no minimum
      0n  // no minimum
    );

    console.log('✅ Liquidity added successfully!');
    console.log('\n🎉 KTA/RIDE pool is ready for trading!');
    console.log(`   Pool: ${pool.poolAddress}`);
    console.log(`   Liquidity: 1 KTA + 100,000 RIDE`);
    console.log('   OPS has SEND_ON_BEHALF permission');
    console.log('   Ready for two-transaction swaps!');

  } catch (error) {
    console.error('\n❌ Operation failed:');
    console.error('Message:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack.slice(0, 500));
    }
  }
}

addRideLiquidity();
