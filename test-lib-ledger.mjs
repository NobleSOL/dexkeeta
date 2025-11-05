// Test using lib.Ledger instead of top-level Ledger
import * as KeetaSDK from '@keetanetwork/keetanet-client';

const KEETA_NODE = 'https://api.test.keeta.com';
const KEETA_NETWORK = 'test';
const TEST_ADDRESS = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';

async function testLibLedger() {
  try {
    console.log('Testing KeetaSDK.lib.Ledger pattern...\n');

    // Check lib.Ledger
    console.log('typeof KeetaSDK.lib.Ledger:', typeof KeetaSDK.lib.Ledger);
    console.log('lib.Ledger keys:', Object.keys(KeetaSDK.lib.Ledger));
    console.log('\n');

    // Test 1: Create Ledger using lib.Ledger
    console.log('✅ Test 1: Creating Ledger with lib.Ledger...');
    const ledger = new KeetaSDK.lib.Ledger({ network: KEETA_NETWORK, nodeUrl: KEETA_NODE });
    console.log('   Ledger created:', ledger.constructor.name);

    // Test 2: Fetch balances
    console.log('\n✅ Test 2: Fetching balances...');
    const balances = await ledger.getAllBalances(TEST_ADDRESS);
    console.log('   Found', balances.length, 'token(s)');

    balances.forEach(b => {
      console.log(`   - ${b.token.substring(0, 30)}...: ${b.balance}`);
    });

    console.log('\n🎉 Success! lib.Ledger works correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testLibLedger();
