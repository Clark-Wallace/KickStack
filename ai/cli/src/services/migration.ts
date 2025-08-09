import * as fs from 'fs';
import * as path from 'path';
import { TableSQL } from '../types';

export class MigrationService {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, '../../../../infra/migrations');
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }
  }

  async writeMigration(tableSQL: TableSQL): Promise<string> {
    const timestamp = this.getTimestamp();
    const filename = `${timestamp}_add_table_${tableSQL.tableName}.sql`;
    const filepath = path.join(this.migrationsDir, filename);

    // Add header comment to migration
    const migrationContent = `-- Migration: Add ${tableSQL.tableName} table
-- Generated: ${new Date().toISOString()}
-- Description: Auto-generated from natural language specification

${tableSQL.sql}

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_${tableSQL.tableName}_created_at ON ${tableSQL.tableName}(created_at);
CREATE INDEX IF NOT EXISTS idx_${tableSQL.tableName}_updated_at ON ${tableSQL.tableName}(updated_at);
`;

    fs.writeFileSync(filepath, migrationContent, 'utf8');
    return filepath;
  }

  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}`;
  }
}