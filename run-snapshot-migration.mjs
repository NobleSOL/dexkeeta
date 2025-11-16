// Run pool_snapshots migration directly on production database
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dexkeeta_db_user:5SS6KgbpnusFw9zaidRyu2jGZYbfrlgv@dpg-d47p04e3jp1c73c5mcog-a.oregon-postgres.render.com/dexkeeta_db';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  console.log('🔧 Running pool_snapshots migration...\n');

  try {
    // Create pool_snapshots table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS pool_snapshots (
        id SERIAL PRIMARY KEY,
        pool_address VARCHAR(255) NOT NULL REFERENCES pools(pool_address) ON DELETE CASCADE,
        reserve_a NUMERIC(78, 0) NOT NULL,
        reserve_b NUMERIC(78, 0) NOT NULL,
        snapshot_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pool_address, snapshot_time)
      );
    `;

    await pool.query(createTableQuery);
    console.log('✅ pool_snapshots table created');

    // Create index
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_pool_snapshots_pool_time
      ON pool_snapshots(pool_address, snapshot_time DESC);
    `;

    await pool.query(createIndexQuery);
    console.log('✅ Index created: idx_pool_snapshots_pool_time');

    // Verify table exists
    const verifyQuery = `
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_name = 'pool_snapshots';
    `;

    const result = await pool.query(verifyQuery);
    console.log(`\n✅ Migration complete! Table exists: ${result.rows[0].count === '1' ? 'YES' : 'NO'}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
