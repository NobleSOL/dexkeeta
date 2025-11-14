#!/usr/bin/env node
import { initializeDatabase, closeDatabase } from './server/keeta-impl/db/client.js';
import { PoolRepository } from './server/keeta-impl/db/pool-repository.js';

async function checkPools() {
  await initializeDatabase();
  const repository = new PoolRepository();
  const pools = await repository.loadPools();

  console.log(`\nFound ${pools.length} pools:\n`);

  pools.forEach((pool, i) => {
    console.log(`${i + 1}. Pool: ${pool.pool_address}`);
    console.log(`   Token A: ${pool.token_a}`);
    console.log(`   Token B: ${pool.token_b}`);
    console.log(`   LP Token: ${pool.lp_token_address || 'NONE'}`);
    console.log(`   Creator: ${pool.creator || 'N/A'}`);
    console.log();
  });

  await closeDatabase();
}

checkPools();
