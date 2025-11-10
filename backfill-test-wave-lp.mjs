// backfill-test-wave-lp.mjs
// One-time script to add TEST/WAVE LP position to database
// Run this on the production server where DATABASE_URL is available

import pg from 'pg';
const { Pool } = pg;

const poolAddress = 'keeta_aqvpd2ear7kby3pjpkvxrkurxk7z2kfv25mcyuqudvzd5xpcz5psup34qnss4';
const ownerAddress = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';
const reserveA = '5123628000000'; // TEST
const reserveB = '14638065058588'; // WAVE

// Calculate shares using sqrt(reserveA * reserveB)
function sqrt(value) {
  if (value < 0n) {
    throw new Error('Square root of negative numbers is not supported');
  }
  if (value < 2n) {
    return value;
  }

  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
}

const product = BigInt(reserveA) * BigInt(reserveB);
const shares = sqrt(product);

console.log('TEST/WAVE LP Backfill');
console.log('Pool:', poolAddress);
console.log('Owner:', ownerAddress);
console.log('Calculated shares:', shares.toString());
console.log('');
console.log('SQL to run on production database:');
console.log('');
console.log(`INSERT INTO lp_positions (pool_address, user_address, shares)`);
console.log(`VALUES ('${poolAddress}', '${ownerAddress}', '${shares.toString()}')`);
console.log(`ON CONFLICT (pool_address, user_address)`);
console.log(`DO UPDATE SET shares = EXCLUDED.shares, updated_at = CURRENT_TIMESTAMP;`);
console.log('');
console.log('You can run this SQL directly on your PostgreSQL database via Render dashboard.');
