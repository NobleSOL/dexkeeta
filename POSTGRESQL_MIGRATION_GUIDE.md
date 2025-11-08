# PostgreSQL Migration Guide for Render

This guide explains how to migrate from file-based storage (`.pools.json`) to PostgreSQL database for production-ready data persistence.

## Why PostgreSQL?

The current `.pools.json` file is stored on Render's ephemeral filesystem, which gets wiped on every deployment. PostgreSQL provides:
- Persistent storage that survives deployments
- ACID transactions for data integrity
- Better performance for complex queries
- Production-ready scalability

## Step 1: Add PostgreSQL to Render

### 1.1 Create PostgreSQL Database on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click "New +" button → Select "PostgreSQL"
3. Configure database:
   - **Name**: `dexkeeta-db` (or your preferred name)
   - **Database**: `dexkeeta` (default is fine)
   - **User**: `dexkeeta` (default is fine)
   - **Region**: Same as your web service (for low latency)
   - **PostgreSQL Version**: 16 (latest stable)
   - **Plan**: Free tier is fine to start (can upgrade later)
4. Click "Create Database"
5. Wait for database to be provisioned (usually 1-2 minutes)

### 1.2 Get Database Connection String

After database is created:
1. Click on your new database in Render dashboard
2. Scroll to "Connections" section
3. Copy the "Internal Database URL" (starts with `postgresql://`)
   - Format: `postgresql://user:password@hostname:5432/database`
   - Use **Internal URL** (not External) for better performance and security

### 1.3 Add Environment Variable to Web Service

1. Go to your Render web service (dexkeeta backend)
2. Go to "Environment" tab
3. Add new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL from step 1.2
4. Click "Save Changes"
5. **Important**: Your service will automatically redeploy after adding this variable

## Step 2: Install PostgreSQL Client Library

Add the `pg` (node-postgres) library to your project:

```bash
pnpm add pg
pnpm add -D @types/pg  # TypeScript types
```

## Step 3: Create Database Schema

Create a new file `server/keeta-impl/db/schema.sql`:

```sql
-- Pools table - stores liquidity pool information
CREATE TABLE IF NOT EXISTS pools (
  id SERIAL PRIMARY KEY,
  pool_address VARCHAR(255) UNIQUE NOT NULL,
  token_a VARCHAR(255) NOT NULL,
  token_b VARCHAR(255) NOT NULL,
  lp_token_address VARCHAR(255),
  creator VARCHAR(255),
  pair_key VARCHAR(511) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LP positions table - stores liquidity provider positions
CREATE TABLE IF NOT EXISTS lp_positions (
  id SERIAL PRIMARY KEY,
  pool_address VARCHAR(255) NOT NULL REFERENCES pools(pool_address) ON DELETE CASCADE,
  user_address VARCHAR(255) NOT NULL,
  shares NUMERIC(78, 0) NOT NULL DEFAULT 0,  -- bigint as string
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pool_address, user_address)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pools_pair_key ON pools(pair_key);
CREATE INDEX IF NOT EXISTS idx_pools_tokens ON pools(token_a, token_b);
CREATE INDEX IF NOT EXISTS idx_lp_positions_user ON lp_positions(user_address);
CREATE INDEX IF NOT EXISTS idx_lp_positions_pool ON lp_positions(pool_address);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pools_updated_at BEFORE UPDATE ON pools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lp_positions_updated_at BEFORE UPDATE ON lp_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Step 4: Create Database Client

Create `server/keeta-impl/db/client.js`:

```javascript
import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Get PostgreSQL connection pool
 */
export function getDbPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    console.log('✅ PostgreSQL pool initialized');
  }

  return pool;
}

/**
 * Initialize database schema
 */
export async function initializeDatabase() {
  const pool = getDbPool();

  try {
    // Read and execute schema file
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, 'schema.sql');

    const schema = await fs.readFile(schemaPath, 'utf8');
    await pool.query(schema);

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connection pool (for graceful shutdown)
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database pool closed');
  }
}
```

## Step 5: Update PoolManager to Use PostgreSQL

Create `server/keeta-impl/db/pool-repository.js`:

```javascript
import { getDbPool } from './client.js';
import { getPairKey } from '../utils/constants.js';

/**
 * Repository for pool database operations
 */
export class PoolRepository {
  /**
   * Save pool to database
   */
  async savePool(poolData) {
    const pool = getDbPool();
    const { poolAddress, tokenA, tokenB, lpTokenAddress, creator } = poolData;
    const pairKey = getPairKey(tokenA, tokenB);

    const query = `
      INSERT INTO pools (pool_address, token_a, token_b, lp_token_address, creator, pair_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (pool_address)
      DO UPDATE SET
        lp_token_address = EXCLUDED.lp_token_address,
        creator = EXCLUDED.creator,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [poolAddress, tokenA, tokenB, lpTokenAddress, creator, pairKey];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Load all pools from database
   */
  async loadPools() {
    const pool = getDbPool();
    const query = 'SELECT * FROM pools ORDER BY created_at ASC;';
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get pool by pair key
   */
  async getPoolByPairKey(tokenA, tokenB) {
    const pool = getDbPool();
    const pairKey = getPairKey(tokenA, tokenB);
    const query = 'SELECT * FROM pools WHERE pair_key = $1;';
    const result = await pool.query(query, [pairKey]);
    return result.rows[0] || null;
  }

  /**
   * Get pool by address
   */
  async getPoolByAddress(poolAddress) {
    const pool = getDbPool();
    const query = 'SELECT * FROM pools WHERE pool_address = $1;';
    const result = await pool.query(query, [poolAddress]);
    return result.rows[0] || null;
  }

  /**
   * Delete pool (if needed)
   */
  async deletePool(poolAddress) {
    const pool = getDbPool();
    const query = 'DELETE FROM pools WHERE pool_address = $1;';
    await pool.query(query, [poolAddress]);
  }

  /**
   * Save LP position
   */
  async saveLPPosition(poolAddress, userAddress, shares) {
    const pool = getDbPool();
    const query = `
      INSERT INTO lp_positions (pool_address, user_address, shares)
      VALUES ($1, $2, $3)
      ON CONFLICT (pool_address, user_address)
      DO UPDATE SET
        shares = EXCLUDED.shares,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [poolAddress, userAddress, shares.toString()];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get LP positions for a pool
   */
  async getLPPositions(poolAddress) {
    const pool = getDbPool();
    const query = 'SELECT * FROM lp_positions WHERE pool_address = $1 AND shares > 0;';
    const result = await pool.query(query, [poolAddress]);
    return result.rows;
  }

  /**
   * Get user's LP positions across all pools
   */
  async getUserPositions(userAddress) {
    const pool = getDbPool();
    const query = `
      SELECT lp.*, p.token_a, p.token_b, p.pool_address
      FROM lp_positions lp
      JOIN pools p ON lp.pool_address = p.pool_address
      WHERE lp.user_address = $1 AND lp.shares > 0;
    `;
    const result = await pool.query(query, [userAddress]);
    return result.rows;
  }

  /**
   * Delete LP position (when shares = 0)
   */
  async deleteLPPosition(poolAddress, userAddress) {
    const pool = getDbPool();
    const query = 'DELETE FROM lp_positions WHERE pool_address = $1 AND user_address = $2;';
    await pool.query(query, [poolAddress, userAddress]);
  }
}
```

## Step 6: Update PoolManager.js

Modify `server/keeta-impl/contracts/PoolManager.js`:

```javascript
// Add at top of file
import { PoolRepository } from '../db/pool-repository.js';

export class PoolManager {
  constructor() {
    this.pools = new Map();
    this.poolAddresses = new Map();
    this.repository = new PoolRepository(); // Add this
    // Remove: this.persistencePath = '.pools.json';
  }

  /**
   * Load pool addresses from database (replaces loadPools)
   */
  async loadPools() {
    try {
      const poolData = await this.repository.loadPools();

      for (const row of poolData) {
        const pairKey = getPairKey(row.token_a, row.token_b);
        this.poolAddresses.set(pairKey, row.pool_address);

        const pool = new Pool(
          row.pool_address,
          row.token_a,
          row.token_b,
          row.lp_token_address || null
        );
        pool.creator = row.creator || null;
        await pool.initialize();
        this.pools.set(pairKey, pool);

        console.log(`📦 Loaded pool: ${pairKey} at ${row.pool_address}`);
      }
    } catch (err) {
      console.error('⚠️ Could not load pools from database:', err.message);
    }
  }

  /**
   * Save pool to database (replaces savePools)
   */
  async savePool(pool) {
    try {
      await this.repository.savePool({
        poolAddress: pool.poolAddress,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        lpTokenAddress: pool.lpTokenAddress,
        creator: pool.creator || null,
      });
    } catch (err) {
      console.error('⚠️ Could not save pool to database:', err.message);
      throw err;
    }
  }

  // Update createPool to call savePool instead of savePools
  async createPool(tokenA, tokenB, creatorAddress) {
    // ... existing code ...

    // Register pool
    this.pools.set(pairKey, pool);
    this.poolAddresses.set(pairKey, poolAddress);

    // Save to database (changed from savePools)
    await this.savePool(pool);

    return pool;
  }

  // Update discoverPoolsOnChain to save discovered pools
  async discoverPoolsOnChain() {
    // ... existing code ...

    if (discovered > 0) {
      console.log(`🎉 Discovered ${discovered} new pools on-chain`);
      // Save each discovered pool to database
      for (const pool of this.pools.values()) {
        await this.savePool(pool);
      }
    }
  }
}
```

## Step 7: Initialize Database on Server Start

Update `server/standalone.ts` or wherever you start the server:

```typescript
import { initializeDatabase } from './keeta-impl/db/client.js';
import { getPoolManager } from './keeta-impl/contracts/PoolManager.js';

async function startServer() {
  try {
    // Initialize database schema
    await initializeDatabase();

    // Initialize pool manager (loads from database)
    await getPoolManager();

    // Start Express server
    const app = createServer();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

## Step 8: Migrate Existing Data (One-Time)

Create a migration script `scripts/migrate-to-postgres.mjs`:

```javascript
import fs from 'fs/promises';
import { initializeDatabase, getDbPool, closeDatabase } from '../server/keeta-impl/db/client.js';
import { PoolRepository } from '../server/keeta-impl/db/pool-repository.js';

async function migrate() {
  try {
    console.log('🔄 Starting migration from .pools.json to PostgreSQL...');

    // Initialize database
    await initializeDatabase();

    // Read existing .pools.json
    const data = await fs.readFile('.pools.json', 'utf8');
    const poolData = JSON.parse(data);

    const repository = new PoolRepository();
    let migrated = 0;

    for (const [pairKey, pool] of Object.entries(poolData)) {
      console.log(`  Migrating ${pairKey}...`);

      await repository.savePool({
        poolAddress: pool.address,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        lpTokenAddress: pool.lpTokenAddress,
        creator: pool.creator,
      });

      migrated++;
    }

    console.log(`✅ Migrated ${migrated} pools to PostgreSQL`);

    // Backup old file
    await fs.rename('.pools.json', '.pools.json.backup');
    console.log('📦 Backed up .pools.json to .pools.json.backup');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await closeDatabase();
  }
}

migrate();
```

Run migration locally before deployment:
```bash
node scripts/migrate-to-postgres.mjs
```

## Step 9: Deploy to Render

1. Commit all changes to git:
```bash
git add .
git commit -m "Migrate from file storage to PostgreSQL"
git push origin main
```

2. Render will automatically deploy your changes
3. The DATABASE_URL environment variable you set in Step 1.3 will be available
4. Database schema will be created automatically on first run

## Step 10: Verify Migration

After deployment:

1. Check Render logs for successful database initialization:
   - Look for "✅ PostgreSQL pool initialized"
   - Look for "✅ Database schema initialized"
   - Look for "📦 Loaded pool: ..." messages

2. Test API endpoints:
```bash
curl https://dexkeeta.onrender.com/api/pools
curl https://dexkeeta.onrender.com/api/liquidity/positions/YOUR_ADDRESS
```

3. Try creating a new pool through the UI
4. Verify data persists after redeployment

## Benefits After Migration

- **Data persistence**: Pools survive deployments and server restarts
- **No more blockchain discovery**: Pools loaded instantly from database
- **Better performance**: Database queries faster than file I/O
- **Production ready**: ACID transactions, concurrent access, backups
- **Scalability**: Can add indexes, optimize queries, use replicas

## Rollback Plan (If Needed)

If migration fails, you can rollback:

1. Remove DATABASE_URL from Render environment variables
2. Restore `.pools.json` from backup:
   ```bash
   mv .pools.json.backup .pools.json
   ```
3. Revert code changes and redeploy

## Cost

- Render PostgreSQL Free Tier: $0/month
  - 1 GB storage
  - 97 hours/month of compute
  - Perfect for development/testing

- Render PostgreSQL Starter: $7/month
  - 10 GB storage
  - Continuous availability
  - Recommended for production

## Next Steps

After successful migration, you can:
1. Remove `.pools.json` and related file operations from codebase
2. Add database backups (Render provides automated backups)
3. Add migrations for schema changes (using tools like `node-pg-migrate`)
4. Implement LP position tracking in database
5. Add transaction history tracking
