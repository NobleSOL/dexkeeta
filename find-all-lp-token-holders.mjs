#!/usr/bin/env node
/**
 * Find ALL holders of the RIDE/TEST LP token
 * This will tell us exactly who owns the LP tokens
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';
const LP_TOKEN_ADDRESS = 'keeta_andxl4w2ohibfzc4cdghcyzv4dduw67oghalx75754kcmx6665co2lxw4h5ga';

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

async function findAllLPHolders() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Find ALL LP Token Holders');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('🪙 LP Token:', LP_TOKEN_ADDRESS);

  try {
    const readOnlyClient = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

    // Get LP token info
    const lpTokenAccountsInfo = await readOnlyClient.client.getAccountsInfo([LP_TOKEN_ADDRESS]);
    const lpTokenInfo = lpTokenAccountsInfo[LP_TOKEN_ADDRESS];

    console.log('\n📊 LP Token Info:');
    console.log('   Name:', lpTokenInfo.info?.name || 'N/A');
    console.log('   Total Supply:', lpTokenInfo.info?.supply?.toString() || '0');
    console.log('   LP Token Account Balance:', lpTokenInfo.balance || '0');

    // Get metadata
    if (lpTokenInfo.info?.metadata) {
      try {
        const metadataStr = Buffer.from(lpTokenInfo.info.metadata, 'base64').toString('utf8');
        const metadata = JSON.parse(metadataStr);
        console.log('   Pool:', metadata.pool);
        console.log('   Token A:', metadata.tokenA);
        console.log('   Token B:', metadata.tokenB);
      } catch (err) {
        console.log('   (Could not parse metadata)');
      }
    }

    // Check known addresses
    const addressesToCheck = [
      { name: 'OPS', address: 'keeta_aab76645t72qwcos7j5bhgmsjyii3rufdezkz566irlqq3aphhblelrd722wz7a' },
      { name: 'LP Token Account (self)', address: LP_TOKEN_ADDRESS },
    ];

    console.log('\n🔍 Checking known addresses for LP token holdings:');

    const holders = [];

    for (const item of addressesToCheck) {
      try {
        const account = KeetaSDK.lib.Account.fromPublicKeyString(item.address);
        const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, account);
        const balances = await client.allBalances({ account });

        for (const b of balances) {
          const tokenAddr = b.token.publicKeyString?.toString() ?? b.token.toString();
          if (tokenAddr === LP_TOKEN_ADDRESS) {
            const balance = BigInt(b.balance ?? 0n);
            if (balance > 0n) {
              holders.push({
                name: item.name,
                address: item.address,
                balance: balance.toString(),
              });
              console.log(`\n✅ ${item.name}`);
              console.log(`   Address: ${item.address.slice(0, 30)}...`);
              console.log(`   Balance: ${balance.toString()}`);
            }
          }
        }
      } catch (err) {
        console.log(`\n❌ Error checking ${item.name}:`, err.message);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total Supply: ${lpTokenInfo.info?.supply?.toString() || '0'}`);
    console.log(`Holders Found: ${holders.length}`);

    if (holders.length > 0) {
      const totalHeld = holders.reduce((sum, h) => sum + BigInt(h.balance), 0n);
      console.log(`Total Held by Known Addresses: ${totalHeld.toString()}`);

      holders.forEach(h => {
        const percent = (Number(h.balance) / Number(lpTokenInfo.info?.supply || 1) * 100).toFixed(2);
        console.log(`  - ${h.name}: ${h.balance} (${percent}%)`);
      });
    }

    console.log('\n💡 NOTE: If you\'re using a different wallet in the UI,');
    console.log('   that wallet address wasn\'t checked here.');
    console.log('   Check the browser console for the connected wallet address.');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAllLPHolders();
