// Fix permissions for KTA/WAVE pool
import { getOpsClient, getOpsAccount, accountFromAddress, KeetaNet } from './server/keeta-impl/utils/client.js';

async function fixPoolPermissions() {
  try {
    const poolAddress = 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek'; // KTA/WAVE pool

    console.log(`🔧 Fixing permissions for pool: ${poolAddress}`);

    const client = await getOpsClient();
    const ops = getOpsAccount();
    const builder = client.initBuilder();

    const poolAccount = accountFromAddress(poolAddress);

    // Grant SEND_ON_BEHALF, STORAGE_DEPOSIT, and ACCESS to OPS
    builder.updatePermissions(
      ops,
      new KeetaNet.lib.Permissions(['SEND_ON_BEHALF', 'STORAGE_DEPOSIT', 'ACCESS']),
      undefined,
      undefined,
      { account: poolAccount }
    );

    console.log('🚀 Publishing permission update...');
    await client.publishBuilder(builder);

    console.log('✅ Pool permissions fixed!');
    console.log('   OPS now has: SEND_ON_BEHALF, STORAGE_DEPOSIT, ACCESS');

  } catch (error) {
    console.error('❌ Failed to fix permissions:');
    console.error('Message:', error.message);
  }
}

fixPoolPermissions();
