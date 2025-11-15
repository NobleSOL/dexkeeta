#!/usr/bin/env node
/**
 * Manually add a pool to the database
 */

import * as KeetaSDK from '@keetanetwork/keetanet-client';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const KEETA_NETWORK = 'test';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

// Your pool address
const POOL_ADDRESS = 'keeta_aruez5emb3q4vf56nvqcyi5ejb337yvlkd73ibph24hv6anncnxbmiqpxcqyc';

async function addPoolToDatabase() {
  console.log('🔧 Adding pool to database...\n');
  console.log(`Pool: ${POOL_ADDRESS}\n`);

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Create Keeta client
    const client = KeetaSDK.UserClient.fromNetwork(KEETA_NETWORK, null);

    // Step 1: Get pool info from blockchain
    console.log('[1/3] Reading pool from blockchain...');
    const poolAccount = KeetaSDK.lib.Account.fromPublicKeyString(POOL_ADDRESS);
    const balances = await client.allBalances({ account: poolAccount });

    if (balances.length !== 2) {
      throw new Error(`Expected 2 token balances, found ${balances.length}`);
    }

    const tokenA = balances[0].token.publicKeyString?.toString() ?? balances[0].token.toString();
    const tokenB = balances[1].token.publicKeyString?.toString() ?? balances[1].token.toString();

    console.log(`✅ Token A: ${tokenA.slice(0, 30)}...`);
    console.log(`✅ Token B: ${tokenB.slice(0, 30)}...`);

    // Step 2: Get LP token address from pool name
    console.log('\n[2/3] Reading LP token address from pool name...');
    const accountsInfo = await client.client.getAccountsInfo([POOL_ADDRESS]);
    const accountInfo = accountsInfo[POOL_ADDRESS];

    if (!accountInfo?.info?.name) {
      throw new Error('No pool name found');
    }

    // Format: "SILVERBACK_POOL|<lpTokenAddress>"
    const parts = accountInfo.info.name.split('|');
    if (parts.length < 2 || parts[0] !== 'SILVERBACK_POOL') {
      throw new Error(`Unexpected pool name format: ${accountInfo.info.name}`);
    }

    const lpTokenAddress = parts[1];
    console.log(`✅ LP Token: ${lpTokenAddress}`);

    // Step 3: Get creator from pool permissions
    console.log('\n[3/3] Saving to database...');
    const pairKey = [tokenA, tokenB].sort().join('|');

    const query = `
      INSERT INTO pools (pool_address, token_a, token_b, lp_token_address, creator, pair_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (pool_address)
      DO UPDATE SET
        lp_token_address = EXCLUDED.lp_token_address,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const result = await pool.query(query, [
      POOL_ADDRESS,
      tokenA,
      tokenB,
      lpTokenAddress,
      null, // Creator unknown - will be discovered
      pairKey,
    ]);

    console.log(`✅ Pool saved to database!`);
    console.log(`\nPool details:`);
    console.log(`  Pool: ${POOL_ADDRESS.slice(-16)}`);
    console.log(`  Token A: ${tokenA.slice(-16)}`);
    console.log(`  Token B: ${tokenB.slice(-16)}`);
    console.log(`  LP Token: ${lpTokenAddress.slice(-16)}`);
    console.log(`\n✅ Done! Pool will now show up for all users.`);

  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addPoolToDatabase();
