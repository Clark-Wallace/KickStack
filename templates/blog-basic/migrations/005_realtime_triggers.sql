-- Add realtime triggers for posts and comments tables

-- Ensure kickstack_changes table exists
CREATE TABLE IF NOT EXISTS kickstack_changes (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  op TEXT NOT NULL, -- 'insert', 'update', 'delete'
  row_id TEXT,
  ts TIMESTAMPTZ DEFAULT now()
);

-- Function to log changes
CREATE OR REPLACE FUNCTION log_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO kickstack_changes (table_name, op, row_id)
    VALUES (TG_TABLE_NAME, lower(TG_OP), OLD.id::TEXT);
    RETURN OLD;
  ELSE
    INSERT INTO kickstack_changes (table_name, op, row_id)
    VALUES (TG_TABLE_NAME, lower(TG_OP), NEW.id::TEXT);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add realtime triggers for posts
DROP TRIGGER IF EXISTS posts_realtime_trigger ON posts;
CREATE TRIGGER posts_realtime_trigger
  AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION log_change();

-- Add realtime triggers for comments
DROP TRIGGER IF EXISTS comments_realtime_trigger ON comments;
CREATE TRIGGER comments_realtime_trigger
  AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION log_change();