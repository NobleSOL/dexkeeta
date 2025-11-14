#!/usr/bin/env node
/**
 * Check existing pool liquidity (read-only, no transactions)
 */

import { getOpsClient, getBalances } from './server/keeta-impl/utils/client.js';

async function checkLiquidity() {
  console.log('\n=== Checking Existing Pool Liquidity ===\n');

  try {
    const opsClient = await getOpsClient();

    // Existing pool and LP token from successful earlier test
    const poolAddress = 'keeta_athz5k3zcwdkhvbhkso3ac34uhanucgzhd2gn3tfhuahgzaljslostzej2lvm';
    const lpTokenAddress = 'keeta_anpqv7dkiafp4w7d6oi4nmowrbmfsmodnitc5fcoaklm4hmn5ojmkzf22i2p2';
    const tokenA = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52'; // KTA
    const tokenB = 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym'; // WAVE

    console.log(`Pool: ${poolAddress.slice(-12)}`);
    console.log(`LP Token: ${lpTokenAddress.slice(-12)}`);
    console.log();

    // Check pool reserves
    console.log('━━━ Pool Reserves ━━━\n');
    const poolBalances = await getBalances(poolAddress);
    const poolKTA = poolBalances.find(b => b.token === tokenA);
    const poolWAVE = poolBalances.find(b => b.token === tokenB);

    console.log(`KTA in pool:  ${poolKTA ? poolKTA.balance.toString() : '0'}`);
    console.log(`WAVE in pool: ${poolWAVE ? poolWAVE.balance.toString() : '0'}`);
    console.log();

    // Check LP token total supply
    console.log('━━━ LP Token Info ━━━\n');
    const accountsInfo = await opsClient.client.getAccountsInfo([lpTokenAddress]);
    const lpInfo = accountsInfo[lpTokenAddress];

    if (lpInfo) {
      console.log(`Name: ${lpInfo.info?.name || 'N/A'}`);
      console.log(`Description: ${lpInfo.info?.description || 'N/A'}`);

      // Try to get supply from balance
      if (lpInfo.balance) {
        console.log(`Total Supply: ${lpInfo.balance}`);
      }
    } else {
      console.log('LP token info not found');
    }
    console.log();

    // Summary
    const hasLiquidity = poolKTA && poolWAVE && poolKTA.balance > 0n && poolWAVE.balance > 0n;
    if (hasLiquidity) {
      console.log('✅ POOL HAS LIQUIDITY - Ready for swaps!');
      console.log(`   View pool: https://explorer.test.keeta.com/account/${poolAddress}`);
      console.log(`   View LP token: https://explorer.test.keeta.com/account/${lpTokenAddress}`);
    } else {
      console.log('❌ Pool is empty - needs liquidity');
    }
    console.log();

  } catch (err) {
    console.error('❌ Query failed');
    console.error(`   Error: ${err.message}`);
    process.exit(1);
  }
}

checkLiquidity();
