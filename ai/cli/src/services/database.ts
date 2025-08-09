import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export class DatabaseService {
  private connectionString: string;
  
  constructor() {
    // Use environment variable or default to Docker connection
    this.connectionString = process.env.KICKSTACK_PG_URI || 
      'postgres://kick:kickpass@localhost:5432/kickstack';
  }

  async tableExists(tableName: string): Promise<boolean> {
    try {
      const query = `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      );`;
      
      const result = await this.runQuery(query);
      return result.includes('t');
    } catch (error) {
      console.error('Error checking table existence:', error);
      return false;
    }
  }

  async executeMigration(sql: string): Promise<void> {
    // Write SQL to temp file and execute via psql
    const tempFile = `/tmp/migration_${Date.now()}.sql`;
    const fs = require('fs');
    fs.writeFileSync(tempFile, sql);
    
    try {
      // Try to use Docker first
      const dockerCommand = `docker compose -f ${path.join(__dirname, '../../../../infra/docker-compose.yml')} exec -T postgres psql -U kick -d kickstack -v ON_ERROR_STOP=1 -f - < ${tempFile}`;
      await execAsync(dockerCommand);
    } catch (dockerError) {
      // Fallback to direct psql if Docker fails
      try {
        const psqlCommand = `psql "${this.connectionString}" -v ON_ERROR_STOP=1 -f ${tempFile}`;
        await execAsync(psqlCommand);
      } catch (psqlError) {
        throw new Error(`Migration failed: ${psqlError}`);
      }
    } finally {
      // Clean up temp file
      fs.unlinkSync(tempFile);
    }
  }

  async getTableColumns(tableName: string): Promise<string[]> {
    try {
      const query = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
        ORDER BY ordinal_position;
      `;
      
      const result = await this.runQuery(query);
      const lines = result.trim().split('\n').slice(2); // Skip header lines
      return lines
        .filter(line => line.trim() && !line.startsWith('('))
        .map(line => {
          const [name, type] = line.split('|').map(s => s.trim());
          return `${name} (${type})`;
        });
    } catch (error) {
      console.error('Error getting table columns:', error);
      return [];
    }
  }

  async getTriggers(tableName: string): Promise<string[]> {
    try {
      const query = `
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public' 
        AND event_object_table = '${tableName}'
        ORDER BY trigger_name;
      `;
      
      const result = await this.runQuery(query);
      const lines = result.trim().split('\n').slice(2); // Skip header lines
      return lines
        .filter(line => line.trim() && !line.startsWith('('))
        .map(line => line.trim());
    } catch (error) {
      console.error('Error getting triggers:', error);
      return [];
    }
  }

  private async runQuery(query: string): Promise<string> {
    try {
      // Try Docker first
      const dockerCommand = `docker compose -f ${path.join(__dirname, '../../../../infra/docker-compose.yml')} exec -T postgres psql -U kick -d kickstack -t -c "${query.replace(/"/g, '\\"')}"`;
      const { stdout } = await execAsync(dockerCommand);
      return stdout;
    } catch (dockerError) {
      // Fallback to direct psql
      try {
        const psqlCommand = `psql "${this.connectionString}" -t -c "${query.replace(/"/g, '\\"')}"`;
        const { stdout } = await execAsync(psqlCommand);
        return stdout;
      } catch (psqlError) {
        throw new Error(`Query failed: ${psqlError}`);
      }
    }
  }

  async runQueryBoolean(query: string): Promise<boolean> {
    const result = await this.runQuery(query);
    return result.toLowerCase().includes('t');
  }

  getConnectionString(): string {
    return this.connectionString;
  }
}