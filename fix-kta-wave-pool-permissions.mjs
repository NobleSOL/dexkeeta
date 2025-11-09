// fix-kta-wave-pool-permissions.mjs
// Fix permissions for KTA/WAVE pool to enable remove liquidity
// Grant OPS wallet SEND_ON_BEHALF and ACCESS on token storage accounts within the pool

import { createUserClient, getOpsAccount, accountFromAddress, KeetaNet } from './server/keeta-impl/utils/client.js';

async function fixPoolPermissions() {
  try {
    // Pool and token addresses
    const KTA_WAVE_POOL = 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek';
    const KTA_TOKEN = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
    const WAVE_TOKEN = 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym';

    // Creator's seed (the wallet that owns the pool)
    const creatorSeed = process.env.USER_SEED || '617B6CAA5B160ACEFA0A97F6574DE27EC1745E0F04C91A7B31C61DC289649620';
    const { client: creatorClient, address: creatorAddress } = createUserClient(creatorSeed);

    console.log('🔧 Fixing KTA/WAVE Pool Permissions\n');
    console.log(`👤 Creator: ${creatorAddress}`);

    const ops = getOpsAccount();
    console.log(`🤖 OPS: ${ops.publicKeyString.get()}\n`);

    console.log(`📦 Pool: ${KTA_WAVE_POOL}`);
    console.log(`🪙 KTA: ${KTA_TOKEN}`);
    console.log(`🪙 WAVE: ${WAVE_TOKEN}\n`);

    // Grant permissions on the pool account itself
    console.log('1️⃣ Granting permissions on pool account...');
    const poolAccount = accountFromAddress(KTA_WAVE_POOL);
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

    // Grant permissions on KTA token storage within pool
    console.log('2️⃣ Granting permissions on KTA token storage...');
    const ktaStoragePath = `${KTA_WAVE_POOL}/${KTA_TOKEN}`;
    const ktaStorageAccount = accountFromAddress(ktaStoragePath);
    const builder2 = creatorClient.initBuilder();

    builder2.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'ACCESS']),
      undefined,
      undefined,
      { account: ktaStorageAccount }
    );

    console.log('   🚀 Publishing...');
    await creatorClient.publishBuilder(builder2);
    console.log('   ✅ KTA storage permissions granted\n');

    // Grant permissions on WAVE token storage within pool
    console.log('3️⃣ Granting permissions on WAVE token storage...');
    const waveStoragePath = `${KTA_WAVE_POOL}/${WAVE_TOKEN}`;
    const waveStorageAccount = accountFromAddress(waveStoragePath);
    const builder3 = creatorClient.initBuilder();

    builder3.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'ACCESS']),
      undefined,
      undefined,
      { account: waveStorageAccount }
    );

    console.log('   🚀 Publishing...');
    await creatorClient.publishBuilder(builder3);
    console.log('   ✅ WAVE storage permissions granted\n');

    console.log('✅ All permissions granted successfully!');
    console.log('🎉 KTA/WAVE pool is now ready for remove liquidity operations\n');

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
