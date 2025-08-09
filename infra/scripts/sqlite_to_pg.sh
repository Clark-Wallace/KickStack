#!/bin/bash

# SQLite to PostgreSQL Migration Script
# This script migrates existing data from SQLite to PostgreSQL

echo "🔄 KickStack SQLite to PostgreSQL Migration"
echo "==========================================="

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INFRA_DIR="$SCRIPT_DIR/.."
SQLITE_DB="$INFRA_DIR/data/kickstack.db"

# Check if SQLite database exists
if [ ! -f "$SQLITE_DB" ]; then
    echo "ℹ️  No SQLite database found at $SQLITE_DB"
    echo "This appears to be a fresh installation. Skipping migration."
    exit 0
fi

echo "Found SQLite database at: $SQLITE_DB"

# Check if PostgreSQL is running
if ! docker compose -f "$INFRA_DIR/docker-compose.yml" ps postgres | grep -q "running"; then
    echo "❌ PostgreSQL container is not running."
    echo "Please start the stack first: docker compose up -d"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Function to export SQLite table to CSV
export_table() {
    local table=$1
    local csv_file="/tmp/${table}.csv"
    
    echo "  Exporting $table..."
    sqlite3 -header -csv "$SQLITE_DB" "SELECT * FROM $table;" > "$csv_file"
    
    if [ -s "$csv_file" ]; then
        echo "  ✓ Exported $(wc -l < "$csv_file") rows"
        return 0
    else
        echo "  - No data in $table"
        rm -f "$csv_file"
        return 1
    fi
}

# Function to import CSV to PostgreSQL
import_table() {
    local table=$1
    local csv_file="/tmp/${table}.csv"
    
    if [ ! -f "$csv_file" ]; then
        return
    fi
    
    echo "  Importing $table to PostgreSQL..."
    
    # Copy CSV file into container and import
    docker cp "$csv_file" kickstack-postgres:/tmp/
    docker compose -f "$INFRA_DIR/docker-compose.yml" exec -T postgres psql -U kick -d kickstack <<EOF
-- Temporarily disable triggers
ALTER TABLE $table DISABLE TRIGGER ALL;

-- Import CSV data
COPY $table FROM '/tmp/${table}.csv' WITH CSV HEADER;

-- Re-enable triggers
ALTER TABLE $table ENABLE TRIGGER ALL;

-- Update sequences if needed
SELECT setval(pg_get_serial_sequence('$table', 'id'), COALESCE(MAX(id), 1)) FROM $table WHERE id IS NOT NULL;
EOF
    
    # Clean up
    docker compose -f "$INFRA_DIR/docker-compose.yml" exec postgres rm "/tmp/${table}.csv"
    rm -f "$csv_file"
    
    echo "  ✓ Imported $table"
}

# Get list of tables from SQLite (excluding system tables)
echo ""
echo "🔍 Discovering tables in SQLite database..."
TABLES=$(sqlite3 "$SQLITE_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'auth_%' AND name != 'kickstack_changes';")

if [ -z "$TABLES" ]; then
    echo "No user tables found to migrate."
    exit 0
fi

echo "Found tables: $(echo $TABLES | tr '\n' ', ')"
echo ""

# Export and import each table
echo "📤 Migrating data..."
for table in $TABLES; do
    echo "Processing $table:"
    if export_table "$table"; then
        import_table "$table"
    fi
    echo ""
done

echo "✅ Migration complete!"
echo ""
echo "Note: Authentication data (auth_* tables) should be recreated via GoTrue."
echo "Please create new user accounts through the signup process."