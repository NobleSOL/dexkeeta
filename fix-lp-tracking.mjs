// Quick script to fix LP position tracking for KTA/TEST pool
import fs from 'fs/promises';

const USER_ADDRESS = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';
const POOL_ADDRESS = 'keeta_aqjezpk3xuv2eyofs37cymoyqj7hsqkgv4kimfvi576s6pbyyiqnvbim67ilo';

// Current reserves from server logs:
// 1209970000 KTA
// 47447971085242 TEST

// Calculate shares using sqrt(reserveA * reserveB)
const reserveA = 1209970000n;
const reserveB = 47447971085242n;

// Calculate total LP shares (geometric mean)
const totalShares = sqrt(reserveA * reserveB);

console.log('📊 Fixing LP position tracking...');
console.log(`  Pool: ${POOL_ADDRESS.slice(-8)}`);
console.log(`  User: ${USER_ADDRESS.slice(-8)}`);
console.log(`  Reserves: ${reserveA} KTA, ${reserveB} TEST`);
console.log(`  Total shares: ${totalShares}`);

const liquidityData = {
  poolAddress: POOL_ADDRESS,
  totalShares: totalShares.toString(),
  positions: {
    [USER_ADDRESS]: {
      lpStorageAddress: null,
      shares: totalShares.toString()
    }
  }
};

const filePath = `.liquidity-positions-${POOL_ADDRESS.slice(-8)}.json`;
await fs.writeFile(filePath, JSON.stringify(liquidityData, null, 2));

console.log(`✅ Updated ${filePath}`);
console.log(`   User now has 100% of pool (${totalShares} shares)`);

// Helper function for BigInt square root
function sqrt(value) {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }
  if (value < 2n) {
    return value;
  }

  function newtonIteration(n, x0) {
    const x1 = ((n / x0) + x0) >> 1n;
    if (x0 === x1 || x0 === (x1 - 1n)) {
      return x0;
    }
    return newtonIteration(n, x1);
  }

  return newtonIteration(value, 1n);
}
