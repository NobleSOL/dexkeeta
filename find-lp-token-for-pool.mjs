#!/usr/bin/env node
/**
 * Find LP token holders by scanning the OPS account's wallet
 * Since we know OPS has an LP token, let's find it and check its details
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';
const POOL_ADDRESS = 'keeta_atxpnzr2b2hqtkv5n4mvtfts3kw27rf5jow4rae45xknveq4anb2zqxq2dsz2';

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

async function findLPTokenForPool() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Find LP Token for Pool');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📍 Target Pool:', POOL_ADDRESS);

  try {
    // Get OPS account
    const opsSeed = process.env.OPS_SEED;
    if (!opsSeed) {
      console.log('❌ OPS_SEED not found in .env');
      return;
    }

    const seedBytes = hexToBytes(opsSeed);
    const opsAccount = KeetaSDK.lib.Account.fromSeed(seedBytes, 0);
    const opsAddress = opsAccount.publicKeyString.get();

    console.log('👤 Scanning OPS wallet:', opsAddress.slice(0, 30) + '...');

    // Create clients
    const opsClient = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, opsAccount);
    const readOnlyClient = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

    // Get all balances
    const balances = await opsClient.allBalances({ account: opsAccount });
    console.log(`\n📊 Found ${balances.length} token balances in OPS wallet\n`);

    // Scan for LP tokens
    for (const b of balances) {
      const tokenAddr = b.token.publicKeyString?.toString() ?? b.token.toString();
      const balance = BigInt(b.balance ?? 0n);

      if (balance === 0n) continue;

      // Check metadata
      const accountsInfo = await readOnlyClient.client.getAccountsInfo([tokenAddr]);
      const accountInfo = accountsInfo[tokenAddr];

      if (!accountInfo?.info?.metadata) continue;

      // Decode metadata
      let metadata;
      try {
        const metadataStr = Buffer.from(accountInfo.info.metadata, 'base64').toString('utf8');
        metadata = JSON.parse(metadataStr);
      } catch (err) {
        continue;
      }

      // Check if it's an LP token for our target pool
      if (metadata.type === 'LP_TOKEN' && metadata.pool === POOL_ADDRESS) {
        console.log('🎯 FOUND LP TOKEN FOR TARGET POOL!');
        console.log('═══════════════════════════════════════════════════════\n');
        console.log('🪙 LP Token Address:', tokenAddr);
        console.log('💰 OPS Balance:', balance.toString());
        console.log('📄 LP Token Name:', accountInfo.info?.name || 'N/A');
        console.log('📊 Total Supply:', accountInfo.info?.supply || '0');
        console.log('\n📝 Metadata:');
        console.log('   Type:', metadata.type);
        console.log('   Pool:', metadata.pool);
        console.log('   Token A:', metadata.tokenA);
        console.log('   Token B:', metadata.tokenB);
        console.log('   Created:', new Date(metadata.createdAt).toISOString());

        // Calculate ownership %
        const totalSupply = BigInt(accountInfo.info?.supply || '0');
        if (totalSupply > 0n) {
          const ownershipPercent = (Number(balance) / Number(totalSupply)) * 100;
          console.log(`\n📈 OPS Ownership: ${ownershipPercent.toFixed(4)}%`);
        }

        console.log('\n═══════════════════════════════════════════════════════');
        return;
      }
    }

    console.log('❌ No LP token found for this pool in OPS wallet');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findLPTokenForPool();
