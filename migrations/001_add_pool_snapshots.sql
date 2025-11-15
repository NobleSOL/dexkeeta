-- Migration: Add pool_snapshots table for APY calculation
-- Run this on the production database

-- Pool snapshots table - stores reserve snapshots for APY calculation
CREATE TABLE IF NOT EXISTS pool_snapshots (
  id SERIAL PRIMARY KEY,
  pool_address VARCHAR(255) NOT NULL REFERENCES pools(pool_address) ON DELETE CASCADE,
  reserve_a NUMERIC(78, 0) NOT NULL,
  reserve_b NUMERIC(78, 0) NOT NULL,
  snapshot_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pool_address, snapshot_time)
);

-- Index for efficient queries by pool and time
CREATE INDEX IF NOT EXISTS idx_pool_snapshots_pool_time ON pool_snapshots(pool_address, snapshot_time DESC);

-- Verify table was created
SELECT 'Pool snapshots table created successfully!' AS status;
