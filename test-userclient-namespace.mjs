// Test UserClient with namespace import pattern
import * as KeetaSDK from '@keetanetwork/keetanet-client';

const KEETA_NETWORK = 'test';
const TEST_ADDRESS = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';

async function testUserClientNamespace() {
  try {
    console.log('Testing UserClient with namespace import...\n');

    // Create client using namespace import
    console.log('✅ Test 1: Creating UserClient...');
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);
    console.log('   UserClient created:', client.constructor.name);

    // Fetch balances
    console.log('\n✅ Test 2: Fetching balances...');
    const balances = await client.getAllBalances({ account: TEST_ADDRESS });
    console.log('   Found', balances.length, 'token(s)');

    balances.forEach(b => {
      console.log(`   - ${b.token.substring(0, 30)}...: ${b.balance}`);
    });

    console.log('\n🎉 Success! UserClient namespace import works correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testUserClientNamespace();
