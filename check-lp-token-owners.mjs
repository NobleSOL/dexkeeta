#!/usr/bin/env node
/**
 * Check who owns LP tokens for a specific pool
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';
const POOL_ADDRESS = 'keeta_atxpnzr2b2hqtkv5n4mvtfts3kw27rf5jow4rae45xknveq4anb2zqxq2dsz2';

async function checkLPTokenOwners() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Check LP Token Owners for Pool');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📍 Pool address:', POOL_ADDRESS);

  try {
    // Create read-only client
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

    // Get pool info to find LP token address
    console.log('\n🔍 Step 1: Checking pool metadata for LP token address...');
    const poolAccountsInfo = await client.client.getAccountsInfo([POOL_ADDRESS]);
    const poolInfo = poolAccountsInfo[POOL_ADDRESS];

    if (!poolInfo) {
      console.log('❌ Pool not found on blockchain');
      return;
    }

    console.log('✅ Pool found');
    console.log('   Balance:', poolInfo.balance);

    // Check if pool has metadata with LP token address
    let lpTokenAddress = null;
    if (poolInfo.info?.metadata) {
      try {
        const metadataStr = Buffer.from(poolInfo.info.metadata, 'base64').toString('utf8');
        const metadata = JSON.parse(metadataStr);
        console.log('📄 Pool metadata:', JSON.stringify(metadata, null, 2));
        lpTokenAddress = metadata.lpTokenAddress;
      } catch (err) {
        console.log('⚠️  Could not parse pool metadata');
      }
    }

    if (!lpTokenAddress) {
      console.log('\n❌ No LP token address found in pool metadata');
      console.log('This pool may not have LP tokens created yet.');
      return;
    }

    console.log('\n🪙 LP Token Address:', lpTokenAddress);

    // Get LP token info
    console.log('\n🔍 Step 2: Fetching LP token details...');
    const lpTokenAccountsInfo = await client.client.getAccountsInfo([lpTokenAddress]);
    const lpTokenInfo = lpTokenAccountsInfo[lpTokenAddress];

    if (!lpTokenInfo) {
      console.log('❌ LP token not found on blockchain');
      return;
    }

    console.log('✅ LP token found');
    console.log('   Total Supply:', lpTokenInfo.info?.supply || '0');
    console.log('   Name:', lpTokenInfo.info?.name || 'N/A');

    // Get LP token metadata
    if (lpTokenInfo.info?.metadata) {
      try {
        const metadataStr = Buffer.from(lpTokenInfo.info.metadata, 'base64').toString('utf8');
        const metadata = JSON.parse(metadataStr);
        console.log('📄 LP Token metadata:', JSON.stringify(metadata, null, 2));
      } catch (err) {
        console.log('⚠️  Could not parse LP token metadata');
      }
    }

    // Now let's check a few known addresses to see who holds LP tokens
    console.log('\n🔍 Step 3: Checking known addresses for LP token balances...');

    const addressesToCheck = [
      { name: 'OPS', address: process.env.OPS_SEED ? KeetaSDK.lib.Account.fromSeed(hexToBytes(process.env.OPS_SEED), 0).publicKeyString.get() : 'keeta_aab76645t72qwcos7j5bhgmsjyii3rufdezkz566irlqq3aphhblelrd722wz7a' },
    ];

    for (const item of addressesToCheck) {
      console.log(`\n👤 Checking ${item.name} (${item.address.slice(0, 20)}...)`);

      try {
        const userAccount = KeetaSDK.lib.Account.fromPublicKeyString(item.address);
        const userClient = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, userAccount);
        const balances = await userClient.allBalances({ account: userAccount });

        let found = false;
        for (const b of balances) {
          const tokenAddr = b.token.publicKeyString?.toString() ?? b.token.toString();
          if (tokenAddr === lpTokenAddress) {
            console.log(`   ✅ HAS LP TOKENS: ${b.balance.toString()}`);
            found = true;
            break;
          }
        }

        if (!found) {
          console.log(`   ❌ No LP tokens found`);
        }
      } catch (err) {
        console.log(`   ❌ Error checking: ${err.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Done!');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

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

checkLPTokenOwners();
