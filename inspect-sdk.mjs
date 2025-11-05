// Inspect Keeta SDK exports to understand structure
import * as KeetaSDK from '@keetanetwork/keetanet-client';

console.log('Inspecting @keetanetwork/keetanet-client exports:\n');

console.log('Top-level keys:', Object.keys(KeetaSDK));
console.log('\n');

// Check what Ledger actually is
console.log('typeof KeetaSDK.Ledger:', typeof KeetaSDK.Ledger);
console.log('Ledger keys:', KeetaSDK.Ledger ? Object.keys(KeetaSDK.Ledger) : 'undefined');
console.log('\n');

// Check UserClient
console.log('typeof KeetaSDK.UserClient:', typeof KeetaSDK.UserClient);
console.log('UserClient keys:', KeetaSDK.UserClient ? Object.keys(KeetaSDK.UserClient) : 'undefined');
console.log('\n');

// Check lib
console.log('typeof KeetaSDK.lib:', typeof KeetaSDK.lib);
console.log('lib keys:', KeetaSDK.lib ? Object.keys(KeetaSDK.lib) : 'undefined');
console.log('\n');

// Try different approaches
console.log('=== Testing different Ledger access patterns ===\n');

// Pattern 1: Direct construction
try {
  const ledger1 = new KeetaSDK.Ledger({ network: 'test', nodeUrl: 'https://api.test.keeta.com' });
  console.log('✅ Pattern 1 (new KeetaSDK.Ledger): SUCCESS');
} catch (e) {
  console.log('❌ Pattern 1 (new KeetaSDK.Ledger):', e.message);
}

// Pattern 2: Check if it's a namespace with Referenced
try {
  console.log('\ntypeof KeetaSDK.Referenced:', typeof KeetaSDK.Referenced);
  if (KeetaSDK.Referenced) {
    console.log('Referenced keys:', Object.keys(KeetaSDK.Referenced));
    console.log('typeof KeetaSDK.Referenced.Ledger:', typeof KeetaSDK.Referenced.Ledger);
  }
} catch (e) {
  console.log('❌ Pattern 2 (KeetaSDK.Referenced):', e.message);
}

// Pattern 3: Check for factory methods
try {
  if (typeof KeetaSDK.Ledger === 'object' && KeetaSDK.Ledger.create) {
    const ledger3 = KeetaSDK.Ledger.create({ network: 'test', nodeUrl: 'https://api.test.keeta.com' });
    console.log('✅ Pattern 3 (KeetaSDK.Ledger.create): SUCCESS');
  } else {
    console.log('❌ Pattern 3 (KeetaSDK.Ledger.create): Method not found');
  }
} catch (e) {
  console.log('❌ Pattern 3:', e.message);
}
