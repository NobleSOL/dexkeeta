// Test allBalances method with UserClient
import { UserClient, lib } from '@keetanetwork/keetanet-client';

const TEST_SEED = 'bf473dcb32e3c5f8bbe96b0ec8ee79e2be7862f4ba8da45dd85a5c77d2ea07e2';
const KEETA_NETWORK = 'test';

async function testAllBalances() {
  try {
    console.log('Creating account from seed...');
    const seedBytes = Buffer.from(TEST_SEED, 'hex');
    const account = lib.Account.fromSeed(seedBytes, 0);
    const address = account.publicKeyString.get();
    console.log('Address:', address);

    console.log('\nCreating UserClient with account...');
    const client = UserClient.fromNetwork(KEETA_NETWORK, account);
    console.log('Client created');

    console.log('\nFetching balances with allBalances()...');
    const balances = await client.allBalances();
    console.log('Raw response:', balances);

    console.log('\n✅ Success! allBalances() works.');
    console.log('Found', balances.length || 0, 'balances');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testAllBalances();
