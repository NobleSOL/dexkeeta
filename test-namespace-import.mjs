// Test namespace import pattern for Keeta SDK
import * as KeetaSDK from '@keetanetwork/keetanet-client';

const KEETA_NODE = 'https://api.test.keeta.com';
const KEETA_NETWORK = 'test';
const TEST_ADDRESS = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';

async function testNamespaceImport() {
  try {
    console.log('Testing namespace import pattern...\n');

    // Test 1: Create Ledger
    console.log('✅ Test 1: Creating Ledger...');
    const ledger = new KeetaSDK.Ledger({ network: KEETA_NETWORK, nodeUrl: KEETA_NODE });
    console.log('   Ledger created:', ledger.constructor.name);

    // Test 2: Fetch balances
    console.log('\n✅ Test 2: Fetching balances...');
    const balances = await ledger.getAllBalances(TEST_ADDRESS);
    console.log('   Found', balances.length, 'token(s)');

    balances.forEach(b => {
      console.log(`   - ${b.token.substring(0, 30)}...: ${b.balance}`);
    });

    // Test 3: UserClient
    console.log('\n✅ Test 3: Creating UserClient...');
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);
    console.log('   UserClient created:', client.constructor.name);

    // Test 4: Account from seed
    console.log('\n✅ Test 4: Creating Account from seed...');
    const testSeed = new Uint8Array(32).fill(1); // Dummy seed
    const account = KeetaSDK.lib.Account.fromSeed(testSeed, 0);
    console.log('   Account created, address:', account.publicKeyString.get().substring(0, 40) + '...');

    console.log('\n🎉 All tests passed! Namespace import works correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testNamespaceImport();
