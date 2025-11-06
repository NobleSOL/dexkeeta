// Return 10 KTA from OPS back to user wallet
import { createUserClient, getOpsClient, getOpsAccount, accountFromAddress } from './server/keeta-impl/utils/client.js';

async function returnKtaToUser() {
  try {
    console.log('💰 Returning 10 KTA from OPS to user wallet\n');

    // User's wallet address
    const userSeed = process.env.USER_SEED || '617B6CAA5B160ACEFA0A97F6574DE27EC1745E0F04C91A7B31C61DC289649620';
    const { address: userAddress } = createUserClient(userSeed);

    const ops = getOpsAccount();
    const opsAddress = ops.publicKeyString.get();
    const opsClient = await getOpsClient();

    console.log(`🤖 OPS: ${opsAddress}`);
    console.log(`👤 User: ${userAddress}\n`);

    // Send 10 KTA back to user (10 * 10^9 = 10000000000 atomic units)
    const ktaAddress = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
    const ktaAccount = accountFromAddress(ktaAddress);
    const userAccount = accountFromAddress(userAddress);

    const opsBuilder = opsClient.initBuilder();
    opsBuilder.send(userAccount, 10000000000n, ktaAccount); // 10 KTA

    console.log('🔙 Sending 10 KTA back to user...');
    await opsClient.publishBuilder(opsBuilder);
    console.log('✅ KTA returned to user wallet!\n');

  } catch (error) {
    console.error('\n❌ Operation failed:');
    console.error('Message:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack.slice(0, 500));
    }
  }
}

returnKtaToUser();
