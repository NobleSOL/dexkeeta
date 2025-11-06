// Fund OPS wallet and create small KTA/RIDE pool
import { createUserClient, getOpsClient, getOpsAccount, accountFromAddress, KeetaNet } from './server/keeta-impl/utils/client.js';
import { getPoolManager } from './server/keeta-impl/contracts/PoolManager.js';

async function fundOpsAndCreatePool() {
  try {
    console.log('💰 Step 1: Fund OPS wallet with KTA for transaction fees\n');

    // User's wallet
    const userSeed = process.env.USER_SEED || '617B6CAA5B160ACEFA0A97F6574DE27EC1745E0F04C91A7B31C61DC289649620';
    const { client: userClient, address: userAddress } = createUserClient(userSeed);

    const ops = getOpsAccount();
    const opsAddress = ops.publicKeyString.get();

    console.log(`👤 User: ${userAddress}`);
    console.log(`🤖 OPS: ${opsAddress}\n`);

    // Send 10 KTA to OPS for transaction fees (10 * 10^9 = 10000000000 atomic units)
    const ktaAddress = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
    const ktaAccount = accountFromAddress(ktaAddress);
    const opsAccount = accountFromAddress(opsAddress);

    const userBuilder = userClient.initBuilder();
    userBuilder.send(opsAccount, 10000000000n, ktaAccount); // 10 KTA

    console.log('🚀 Sending 10 KTA to OPS for fees...');
    await userClient.publishBuilder(userBuilder);
    console.log('✅ OPS funded!\n');

    console.log('🏗️  Step 2: Create KTA/RIDE pool\n');

    const KTA = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
    const RIDE = 'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo';

    const poolManager = await getPoolManager();

    console.log('📊 Creating KTA/RIDE pool...');
    const ktaRidePool = await poolManager.createPool(KTA, RIDE, userAddress);
    console.log(`✅ KTA/RIDE pool created: ${ktaRidePool.poolAddress}\n`);

    console.log('💧 Step 3: Add liquidity (1 KTA + 100,000 RIDE)\n');

    // 1 KTA = 1 * 10^9 atomic units
    // 100,000 RIDE = 100000 * 10^5 = 10000000000 atomic units (RIDE has 5 decimals)
    const ktaAmount = 1000000000n; // 1 KTA
    const rideAmount = 10000000000n; // 100,000 RIDE

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

    console.log('✅ Liquidity added!');
    console.log('\n🎉 Pool created and funded successfully!');
    console.log(`   Pool: ${ktaRidePool.poolAddress}`);
    console.log(`   Liquidity: 1 KTA + 100,000 RIDE`);
    console.log('✅ OPS has SEND_ON_BEHALF permission');
    console.log('✅ Ready for permissionless swaps!');

  } catch (error) {
    console.error('\n❌ Operation failed:');
    console.error('Message:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack.slice(0, 500));
    }
  }
}

fundOpsAndCreatePool();
