#!/usr/bin/env node
/**
 * Check LP token state before attempting to remove liquidity
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';
const LP_TOKEN_ADDRESS = 'keeta_andxl4w2ohibfzc4cdghcyzv4dduw67oghalx75754kcmx6665co2lxw4h5ga';
const OPS_ADDRESS = 'keeta_aab76645t72qwcos7j5bhgmsjyii3rufdezkz566irlqq3aphhblelrd722wz7a';

function hexToBytes(hex) {
  const cleanHex = hex.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(cleanHex)) {
    throw new Error(`Invalid seed: must be 64 hex characters. Got ${cleanHex.length} characters.`);
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

async function checkLPTokenState() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  LP Token State Before Remove Liquidity');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const readOnlyClient = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

    // Get LP token info
    console.log('🪙 LP Token:', LP_TOKEN_ADDRESS.slice(0, 30) + '...');
    const lpTokenAccountsInfo = await readOnlyClient.client.getAccountsInfo([LP_TOKEN_ADDRESS]);
    const lpTokenInfo = lpTokenAccountsInfo[LP_TOKEN_ADDRESS];

    console.log('\n📊 LP Token Account State:');
    console.log('   Total Supply:', lpTokenInfo.info?.supply || '0');
    console.log('   LP Token Account Balance:', lpTokenInfo.balance || '0');

    // Get OPS balance of LP tokens
    const opsSeed = process.env.OPS_SEED;
    if (!opsSeed) {
      console.log('❌ OPS_SEED not found');
      return;
    }

    const seedBytes = hexToBytes(opsSeed);
    const opsAccount = KeetaSDK.lib.Account.fromSeed(seedBytes, 0);
    const opsClient = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, opsAccount);

    const opsBalances = await opsClient.allBalances({ account: opsAccount });

    let opsLPBalance = 0n;
    for (const b of opsBalances) {
      const tokenAddr = b.token.publicKeyString?.toString() ?? b.token.toString();
      if (tokenAddr === LP_TOKEN_ADDRESS) {
        opsLPBalance = BigInt(b.balance ?? 0n);
        break;
      }
    }

    console.log('\n👤 OPS Wallet:');
    console.log('   Address:', OPS_ADDRESS.slice(0, 30) + '...');
    console.log('   LP Token Balance:', opsLPBalance.toString());

    console.log('\n📈 Analysis:');
    console.log('   Total Supply:', lpTokenInfo.info?.supply || '0');
    console.log('   OPS holds:', opsLPBalance.toString(), `(${(Number(opsLPBalance) / Number(lpTokenInfo.info?.supply || 1) * 100).toFixed(2)}%)`);
    console.log('   LP Token Account holds:', lpTokenInfo.balance || '0');

    console.log('\n⚠️  BURN STRATEGY:');
    if (BigInt(lpTokenInfo.balance || 0) === 0n) {
      console.log('   ❌ LP token account has 0 balance!');
      console.log('   ❌ Current burn code will fail because it tries to burn from LP token account');
      console.log('   ✅ FIX NEEDED: Send LP tokens from OPS to LP token account FIRST, then burn');
    } else {
      console.log('   ✅ LP token account has balance, burn should work');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLPTokenState();
