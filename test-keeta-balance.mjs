// Test fetching Keeta balances using the SDK
import { UserClient } from '@keetanetwork/keetanet-client';

const TEST_ADDRESS = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi'; // Your test wallet

async function testBalances() {
  try {
    console.log('Creating Keeta client...');
    const client = UserClient.fromNetwork('test', null);

    console.log(`Fetching balances for: ${TEST_ADDRESS}`);
    const balances = await client.getAllBalances({ account: TEST_ADDRESS });

    console.log('Balances:', balances);

    if (balances.length === 0) {
      console.log('❌ No balances found - wallet might be empty');
    } else {
      console.log(`✅ Found ${balances.length} token(s)`);
      balances.forEach(b => {
        console.log(`  - ${b.token}: ${b.balance}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBalances();
