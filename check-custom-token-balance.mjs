#!/usr/bin/env node
/**
 * Check user balance of custom tokens
 */

import * as KeetaNet from '@keetanetwork/keetanet-client';

function seedFromHex(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

async function checkBalance() {
  console.log('\n━━━ Checking Token Balances ━━━\n');

  try {
    // User account
    const userSeed = '7f6100a750aa11b6db66cfcfc2df863fa9f0d2d09363f101fc328bddc9aa8cfb';
    const seed = seedFromHex(userSeed);
    const userAccount = KeetaNet.lib.Account.fromSeed(seed, 0);
    const userClient = KeetaNet.UserClient.fromNetwork('test', userAccount);
    const userAddress = userAccount.publicKeyString.get();

    console.log(`User: ${userAddress}\n`);

    // Custom token pair
    const tokenA = 'keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo';
    const tokenB = 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym';

    console.log('Fetching all user balances...\n');
    const userBalances = await userClient.allBalances({ account: userAccount });

    let tokenABalance = 0n;
    let tokenBBalance = 0n;

    for (const bal of userBalances) {
      const token = bal.token?.publicKeyString?.get?.() || bal.token?.toString();
      const amount = BigInt(bal.balance || bal.value || 0);

      if (token === tokenA) tokenABalance = amount;
      if (token === tokenB) tokenBBalance = amount;
    }

    console.log('Token Balances:\n');
    console.log(`Token A: ${tokenA}`);
    console.log(`Balance: ${Number(tokenABalance) / 1e9} tokens\n`);

    console.log(`Token B: ${tokenB}`);
    console.log(`Balance: ${Number(tokenBBalance) / 1e9} tokens\n`);

    if (tokenABalance >= 10000000000n && tokenBBalance >= 10000000000n) {
      console.log('✅ User has enough tokens for liquidity!\n');
    } else {
      console.log('⚠️  User does NOT have enough tokens:');
      console.log(`   Need 10 of each token`);
      console.log(`   Have ${Number(tokenABalance) / 1e9} Token A`);
      console.log(`   Have ${Number(tokenBBalance) / 1e9} Token B\n`);
    }

    // Show all balances
    console.log('All user token balances:\n');
    for (const bal of userBalances) {
      const token = bal.token?.publicKeyString?.get?.() || bal.token?.toString();
      const amount = BigInt(bal.balance || bal.value || 0);
      console.log(`  ${token.slice(-12)}: ${Number(amount) / 1e9}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkBalance();
