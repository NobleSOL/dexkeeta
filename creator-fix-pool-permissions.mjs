// Creator grants SEND_ON_BEHALF to OPS on their pool
import { createUserClient, getOpsAccount, accountFromAddress, KeetaNet } from './server/keeta-impl/utils/client.js';

async function fixPoolPermissions() {
  try {
    // Creator's seed (the wallet that owns both pools)
    const creatorSeed = process.env.USER_SEED || '617B6CAA5B160ACEFA0A97F6574DE27EC1745E0F04C91A7B31C61DC289649620';
    const { client: creatorClient, address: creatorAddress } = createUserClient(creatorSeed);

    console.log(`👤 Creator: ${creatorAddress}`);

    // Pools to fix
    const pools = [
      'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek', // KTA/WAVE
      'keeta_athjolef2zpnj6pimky2sbwbe6cmtdxakgixsveuck7fd7ql2vrf6mxkh4gy4', // KTA/RIDE
    ];

    const ops = getOpsAccount();
    console.log(`🤖 OPS: ${ops.publicKeyString.get()}\n`);

    for (const poolAddress of pools) {
      console.log(`🔧 Fixing pool: ${poolAddress.slice(-8)}...`);

      const builder = creatorClient.initBuilder();
      const poolAccount = accountFromAddress(poolAddress);

      // Grant SEND_ON_BEHALF, STORAGE_DEPOSIT, and ACCESS to OPS
      builder.updatePermissions(
        ops,
        new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'STORAGE_DEPOSIT', 'ACCESS']),
        undefined,
        undefined,
        { account: poolAccount }
      );

      console.log('   🚀 Publishing permission update...');
      await creatorClient.publishBuilder(builder);
      console.log('   ✅ Pool permissions fixed!');
    }

    console.log('\n✅ All pools fixed! OPS now has SEND_ON_BEHALF permissions.');

  } catch (error) {
    console.error('\n❌ Failed to fix permissions:');
    console.error('Message:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.slice(0, 300));
    }
  }
}

fixPoolPermissions();
