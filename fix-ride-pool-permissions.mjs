// fix-ride-pool-permissions.mjs
// Fix permissions for RIDE/KTA pool to enable swaps
// Grant OPS wallet SEND_ON_BEHALF and ACCESS on token storage accounts within the pool

import { createUserClient, getOpsAccount, accountFromAddress, KeetaNet } from './server/keeta-impl/utils/client.js';

async function fixPoolPermissions() {
  try {
    // Pool and token addresses
    const RIDE_KTA_POOL = 'keeta_athjolef2zpnj6pimky2sbwbe6cmtdxakgixsveuck7fd7ql2vrf6mxkh4gy4';
    const RIDE_TOKEN = 'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo';
    const KTA_TOKEN = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';

    // Creator's seed (the wallet that owns the pool)
    const creatorSeed = process.env.USER_SEED || '617B6CAA5B160ACEFA0A97F6574DE27EC1745E0F04C91A7B31C61DC289649620';
    const { client: creatorClient, address: creatorAddress } = createUserClient(creatorSeed);

    console.log('🔧 Fixing RIDE/KTA Pool Permissions\n');
    console.log(`👤 Creator: ${creatorAddress}`);

    const ops = getOpsAccount();
    console.log(`🤖 OPS: ${ops.publicKeyString.get()}\n`);

    console.log(`📦 Pool: ${RIDE_KTA_POOL}`);
    console.log(`🪙 RIDE: ${RIDE_TOKEN}`);
    console.log(`🪙 KTA: ${KTA_TOKEN}\n`);

    // Grant permissions on the pool account itself
    console.log('1️⃣ Granting permissions on pool account...');
    const poolAccount = accountFromAddress(RIDE_KTA_POOL);
    const builder1 = creatorClient.initBuilder();

    builder1.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'STORAGE_DEPOSIT', 'ACCESS']),
      undefined,
      undefined,
      { account: poolAccount }
    );

    console.log('   🚀 Publishing...');
    await creatorClient.publishBuilder(builder1);
    console.log('   ✅ Pool account permissions granted\n');

    // Grant permissions on RIDE token storage within pool
    console.log('2️⃣ Granting permissions on RIDE token storage...');
    const rideStoragePath = `${RIDE_KTA_POOL}/${RIDE_TOKEN}`;
    const rideStorageAccount = accountFromAddress(rideStoragePath);
    const builder2 = creatorClient.initBuilder();

    builder2.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'ACCESS']),
      undefined,
      undefined,
      { account: rideStorageAccount }
    );

    console.log('   🚀 Publishing...');
    await creatorClient.publishBuilder(builder2);
    console.log('   ✅ RIDE storage permissions granted\n');

    // Grant permissions on KTA token storage within pool
    console.log('3️⃣ Granting permissions on KTA token storage...');
    const ktaStoragePath = `${RIDE_KTA_POOL}/${KTA_TOKEN}`;
    const ktaStorageAccount = accountFromAddress(ktaStoragePath);
    const builder3 = creatorClient.initBuilder();

    builder3.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'ACCESS']),
      undefined,
      undefined,
      { account: ktaStorageAccount }
    );

    console.log('   🚀 Publishing...');
    await creatorClient.publishBuilder(builder3);
    console.log('   ✅ KTA storage permissions granted\n');

    console.log('✅ All permissions granted successfully!');
    console.log('🎉 RIDE/KTA pool is now ready for swaps\n');

  } catch (error) {
    console.error('\n❌ Permission grant failed:');
    console.error('Message:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.slice(0, 300));
    }
    process.exit(1);
  }
}

fixPoolPermissions();
