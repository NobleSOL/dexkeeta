// check-pool-permissions.mjs
// Check if OPS has SEND_ON_BEHALF permissions on existing pools

import { getOpsClient, getOpsAccount } from './server/keeta-impl/utils/client.js';
import fs from 'fs/promises';

async function checkPoolPermissions() {
  try {
    // Load pools from .pools.json
    const poolsData = JSON.parse(await fs.readFile('.pools.json', 'utf8'));

    console.log('📋 Checking permissions for pools:', Object.keys(poolsData));

    const client = await getOpsClient();
    const ops = getOpsAccount();
    const opsAddress = ops.publicKeyString.get();

    console.log('🔧 Ops address:', opsAddress);

    // Check permissions for each pool
    for (const [pairKey, poolInfo] of Object.entries(poolsData)) {
      console.log(`\n🔍 Checking pool: ${pairKey}`);
      console.log(`   Pool address: ${poolInfo.address}`);

      try {
        // Get account info to check permissions
        const accountsInfo = await client.client.getAccountsInfo([poolInfo.address]);
        const info = accountsInfo[poolInfo.address];

        if (info?.permissions) {
          console.log('   📜 Permissions found:');

          // Try to find OPS in permissions
          // permissions is typically a Map or object of address -> permission set
          let opsHasPermissions = false;
          let opsPermissionsList = null;

          if (typeof info.permissions === 'object') {
            for (const [addr, perms] of Object.entries(info.permissions)) {
              if (addr === opsAddress || addr.includes(opsAddress.slice(-10))) {
                opsHasPermissions = true;
                opsPermissionsList = perms;
                console.log(`   ✅ OPS has permissions:`, perms);
              }
            }
          }

          if (!opsHasPermissions) {
            console.log('   ❌ OPS does NOT have permissions on this pool!');
            console.log('      This pool needs permission fix before swaps will work.');
          }
        } else {
          console.log('   ℹ️ No permissions info returned (may need different query method)');
        }

        // Also log general account info
        console.log('   Info keys:', Object.keys(info || {}));

        // Check info.info for nested permissions
        if (info.info) {
          console.log('   info.info keys:', Object.keys(info.info));
          if (info.info.permissions) {
            console.log('   📜 Permissions in info.info:', info.info.permissions);
          }
          if (info.info.defaultPermission) {
            console.log('   📜 Default Permission:', info.info.defaultPermission);
            // Try to decode if it's an object
            if (typeof info.info.defaultPermission === 'object') {
              console.log('   📜 Default Permission (JSON):', JSON.stringify(info.info.defaultPermission, null, 2));
            }
          }
        }
      } catch (err) {
        console.error(`   ❌ Error checking pool ${poolInfo.address}:`, err.message);
      }
    }

    console.log('\n✅ Permission check complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPoolPermissions();
