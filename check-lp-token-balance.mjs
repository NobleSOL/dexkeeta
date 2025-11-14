#!/usr/bin/env node
/**
 * Check LP token account balance to see where minted tokens go
 */

import * as KeetaNet from '@keetanetwork/keetanet-client';

const lpTokenAddress = 'keeta_apebvqklting2dl7zr3jyewcdgb4av4emuiwsfueebimadgwjn7aijszq6sw4';
const creatorAddress = 'keeta_aabuf556k7q465i3p6c7xdhirnems2rkgtorfn6j6wwic5iwlo7pjr4h7aolayi';

function seedFromHex(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

async function checkBalances() {
  console.log('Checking where the minted LP tokens went...\n');

  const userSeed = '7f6100a750aa11b6db66cfcfc2df863fa9f0d2d09363f101fc328bddc9aa8cfb';
  const seed = seedFromHex(userSeed);
  const userAccount = KeetaNet.lib.Account.fromSeed(seed, 0);
  const userClient = KeetaNet.UserClient.fromNetwork('test', userAccount);

  // Check LP token account info and balance
  console.log('━━━ LP Token Account Info ━━━\n');
  const lpInfo = await userClient.client.getAccountsInfo([lpTokenAddress]);
  const info = lpInfo[lpTokenAddress];

  if (info) {
    console.log(`LP Token: ${lpTokenAddress.slice(-12)}`);
    console.log(`Name: ${info.info?.name}`);
    console.log(`Total Supply: ${info.balance ? Number(BigInt(info.balance)) / 1e9 : 0}`);
    console.log();
  }

  // Check creator balance
  console.log('━━━ Creator LP Token Balance ━━━\n');
  const creatorBalances = await userClient.allBalances({ account: userAccount });

  let found = false;
  for (const bal of creatorBalances) {
    const token = bal.token?.publicKeyString?.get?.() || bal.token?.toString();
    if (token === lpTokenAddress) {
      const amount = BigInt(bal.balance || bal.value || 0);
      console.log(`Creator: ${creatorAddress.slice(-12)}`);
      console.log(`Balance: ${Number(amount) / 1e9} LP tokens`);
      found = true;
      break;
    }
  }

  if (!found) {
    console.log(`Creator: ${creatorAddress.slice(-12)}`);
    console.log(`Balance: 0 LP tokens (not found in balance list)`);
  }
  console.log();

  // Check LP token's own balances
  console.log('━━━ LP Token Account Balances ━━━\n');
  const lpTokenAccount = KeetaNet.lib.Account.fromPublicKeyString(lpTokenAddress);
  const lpBalances = await userClient.allBalances({ account: lpTokenAccount });

  console.log(`LP Token holds ${lpBalances.length} token type(s):\n`);
  for (const bal of lpBalances) {
    const token = bal.token?.publicKeyString?.get?.() || bal.token?.toString();
    const amount = BigInt(bal.balance || bal.value || 0);
    console.log(`  ${token.slice(-12)}: ${Number(amount) / 1e9}`);
  }

  if (lpBalances.length === 0) {
    console.log('  (none)');
  }
}

checkBalances().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
