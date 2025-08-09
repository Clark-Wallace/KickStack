-- KickStack Realtime Change Log Table
-- This table captures all INSERT/UPDATE/DELETE operations for realtime sync
-- Generated: System initialization

CREATE TABLE IF NOT EXISTS kickstack_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,                -- unix epoch milliseconds
  table_name TEXT NOT NULL,           -- name of the affected table
  op TEXT NOT NULL,                   -- operation: 'insert' | 'update' | 'delete'
  rowid_value INTEGER,                 -- affected rowid if available
  payload TEXT                         -- JSON snapshot (minimal data)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_kc_ts ON kickstack_changes(ts);
CREATE INDEX IF NOT EXISTS idx_kc_table ON kickstack_changes(table_name);
CREATE INDEX IF NOT EXISTS idx_kc_table_id ON kickstack_changes(table_name, id);

-- Cleanup old changes (optional - keeps last 10000 changes)
-- This trigger prevents unbounded growth of the changes table
CREATE TRIGGER IF NOT EXISTS tr_kickstack_changes_cleanup
AFTER INSERT ON kickstack_changes
WHEN (SELECT COUNT(*) FROM kickstack_changes) > 10000
BEGIN
  DELETE FROM kickstack_changes 
  WHERE id IN (
    SELECT id FROM kickstack_changes 
    ORDER BY id ASC 
    LIMIT (SELECT COUNT(*) - 10000 FROM kickstack_changes)
  );
END;