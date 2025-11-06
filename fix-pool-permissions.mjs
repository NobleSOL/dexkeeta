// fix-pool-permissions.mjs
// Script to grant Ops the necessary permissions on existing pools
// Pool owner must run this script with their WALLET_SEED

import { getOpsAccount, accountFromAddress, KeetaNet, createUserClient } from './server/keeta-impl/utils/client.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

async function fixPoolPermissions() {
  // Load pools from .pools.json
  const poolsData = JSON.parse(await fs.readFile('.pools.json', 'utf8'));

  console.log('📋 Found pools:', Object.keys(poolsData).length);

  // Get the user seed from environment (defaults to the standard user seed)
  const userSeed = process.env.WALLET_SEED || process.env.USER_SEED || '617B6CAA5B160ACEFA0A97F6574DE27EC1745E0F04C91A7B31C61DC289649620';

  const { client: userClient, account: userAccount } = createUserClient(userSeed);
  const ops = getOpsAccount();
  const opsAddress = ops.publicKeyString.get();
  const userAddress = userAccount.publicKeyString.get();

  console.log('👤 Pool owner:', userAddress.slice(0, 30) + '...');
  console.log('🔧 Ops address:', opsAddress.slice(0, 30) + '...');

  // Fix permissions for each pool
  for (const [pairKey, poolInfo] of Object.entries(poolsData)) {
    console.log(`\n🔧 Fixing permissions for pool: ${pairKey.slice(0, 40)}...`);
    console.log(`   Pool address: ${poolInfo.address}`);
    console.log(`   Creator: ${poolInfo.creator || 'unknown'}`);

    // Check if user is the creator
    if (poolInfo.creator && poolInfo.creator.toLowerCase() !== userAddress.toLowerCase()) {
      console.log(`   ⚠️ SKIPPING: You are not the creator of this pool!`);
      console.log(`      Pool creator: ${poolInfo.creator}`);
      console.log(`      Your address: ${userAddress}`);
      continue;
    }

    const builder = userClient.initBuilder();
    const poolAccount = accountFromAddress(poolInfo.address);

    // Grant Ops the necessary permissions: SEND_ON_BEHALF, STORAGE_DEPOSIT, ACCESS
    builder.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'STORAGE_DEPOSIT', 'ACCESS']),
      undefined,
      undefined,
      { account: poolAccount }
    );

    console.log('   📝 Granting Ops: SEND_ON_BEHALF, STORAGE_DEPOSIT, ACCESS');

    try {
      await userClient.publishBuilder(builder);
      console.log('   ✅ Permissions updated successfully');
    } catch (err) {
      console.error(`   ❌ Error updating permissions:`, err.message);
    }
  }

  console.log('\n✅ All pool permissions checked!');
}

fixPoolPermissions().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
