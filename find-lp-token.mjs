#!/usr/bin/env node
/**
 * Find LP token for a pool by scanning all tokens owned by the pool
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';

const KEETA_NETWORK = 'test';
const POOL_ADDRESS = 'keeta_aruez5emb3q4vf56nvqcyi5ejb337yvlkd73ibph24hv6anncnxbmiqpxcqyc';

async function findLPToken() {
  console.log('🔍 Finding LP token for pool...\n');
  console.log(`Pool: ${POOL_ADDRESS}\n`);

  const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);
  const poolAccount = KeetaSDK.lib.Account.fromPublicKeyString(POOL_ADDRESS);

  // Get all balances (tokens) in the pool account
  console.log('Reading pool balances...');
  const balances = await client.allBalances({ account: poolAccount });

  console.log(`\nFound ${balances.length} tokens in pool:`);
  for (const balance of balances) {
    const tokenAddr = balance.token.publicKeyString?.toString() ?? balance.token.toString();
    const amount = balance.balance?.toString() ?? '0';
    console.log(`  ${tokenAddr.slice(-16)}: ${amount}`);
  }

  // Get pool metadata
  console.log('\nPool metadata:');
  const accountsInfo = await client.client.getAccountsInfo([POOL_ADDRESS]);
  const accountInfo = accountsInfo[POOL_ADDRESS];
  console.log(`  Name: ${accountInfo?.info?.name}`);
  console.log(`  Description: ${accountInfo?.info?.description}`);

  // Check for any child accounts (storage paths under this pool)
  console.log('\nLooking for LP token in pool storage...');

  // The LP token might be a fungible token created by the pool
  // Let's search for tokens that have the pool in their name/metadata
  console.log('\n🔍 Checking if any tokens reference this pool...');

  console.log(`\nℹ️ Manual check needed:`);
  console.log(`1. Go to https://explorer.test.keeta.com/account/${POOL_ADDRESS}`);
  console.log(`2. Look for any fungible tokens created by or associated with this pool`);
  console.log(`3. The LP token should have "LP" or the pool address in its name`);
}

findLPToken().catch(console.error);
