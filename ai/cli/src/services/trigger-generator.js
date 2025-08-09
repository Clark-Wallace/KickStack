"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerGenerator = void 0;
class TriggerGenerator {
    static generateTriggers(tableName) {
        const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
        return `-- Realtime triggers for table: ${tableName}
-- Generated: ${new Date().toISOString()}

-- Create trigger function for ${tableName}
CREATE OR REPLACE FUNCTION kickstack_notify_${safeName}() RETURNS trigger AS $$
BEGIN
  INSERT INTO kickstack_changes (ts, table_name, op, row_pk, payload)
  VALUES (
    EXTRACT(EPOCH FROM clock_timestamp())::BIGINT * 1000,
    '${tableName}',
    TG_OP::text,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id::text
      ELSE NEW.id::text
    END,
    CASE 
      WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
      WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
      WHEN TG_OP = 'DELETE' THEN json_build_object('id', OLD.id)::jsonb
      ELSE NULL
    END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS tr_${safeName}_changes ON ${tableName};

-- Create trigger for all operations
CREATE TRIGGER tr_${safeName}_changes
AFTER INSERT OR UPDATE OR DELETE ON ${tableName}
FOR EACH ROW EXECUTE FUNCTION kickstack_notify_${safeName}();

-- Grant execute permission on trigger function
GRANT EXECUTE ON FUNCTION kickstack_notify_${safeName}() TO anon, authenticated;`;
    }
    static generateDropTriggers(tableName) {
        const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
        return `-- Drop realtime triggers for table: ${tableName}
DROP TRIGGER IF EXISTS tr_${safeName}_changes ON ${tableName};
DROP FUNCTION IF EXISTS kickstack_notify_${safeName}();`;
    }
    // PostgreSQL-specific helper for getting table primary key
    static generateGetPrimaryKey(tableName) {
        return `
SELECT column_name 
FROM information_schema.key_column_usage 
WHERE table_schema = 'public' 
  AND table_name = '${tableName}' 
  AND constraint_name = (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
      AND table_name = '${tableName}' 
      AND constraint_type = 'PRIMARY KEY'
  );`;
    }
}
exports.TriggerGenerator = TriggerGenerator;
//# sourceMappingURL=trigger-generator.js.map