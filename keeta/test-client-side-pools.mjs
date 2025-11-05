// Test client-side pool reserves fetching
import * as KeetaSDK from '@keetanetwork/keetanet-client';

const KEETA_NETWORK = 'test';

const POOL_ADDRESS = 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek';
const KTA_TOKEN = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
const WAVE_TOKEN = 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym';

async function testClientSidePools() {
  try {
    console.log('🔍 Testing client-side pool reserves fetching...');
    console.log('');

    // Create client (no account needed for read-only)
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);
    console.log('✅ Client created');

    // Create account object from pool address
    const poolAccount = KeetaSDK.lib.Account.fromPublicKeyString(POOL_ADDRESS);
    console.log('✅ Pool account created:', poolAccount.publicKeyString.get());

    // Query balances for the pool account
    console.log('🔍 Fetching balances for pool account...');
    const rawBalances = await client.allBalances({ account: poolAccount });
    console.log('✅ Raw balances:', rawBalances);
    console.log('');

    // Extract token balances
    let reserveA = 0n;
    let reserveB = 0n;

    for (const b of rawBalances) {
      const tokenAddr = b.token.publicKeyString?.toString() ?? b.token.toString();
      const balance = BigInt(b.balance ?? 0n);

      console.log(`  Token: ${tokenAddr.slice(0, 20)}... Balance: ${balance}`);

      if (tokenAddr === KTA_TOKEN) {
        reserveA = balance;
        console.log('    ✅ This is KTA (tokenA)');
      } else if (tokenAddr === WAVE_TOKEN) {
        reserveB = balance;
        console.log('    ✅ This is WAVE (tokenB)');
      }
    }

    console.log('');
    console.log('📊 Final Reserves:');
    console.log('  KTA (reserveA):', reserveA.toString());
    console.log('  WAVE (reserveB):', reserveB.toString());
    console.log('  KTA (human):', Number(reserveA) / 1e9);
    console.log('  WAVE (human):', Number(reserveB) / 1e9);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testClientSidePools();
