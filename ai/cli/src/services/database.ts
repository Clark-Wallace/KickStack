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
    
    try {
      fs.writeFileSync(tempFile, sql);
    } catch (fileError) {
      throw new Error(`Failed to write migration file: ${fileError}`);
    }
    
    try {
      // Check if Docker is available and services are running
      await execAsync('docker info');
      
      const composePath = path.join(__dirname, '../../../../infra/docker-compose.yml');
      if (!fs.existsSync(composePath)) {
        throw new Error(`Docker Compose file not found at: ${composePath}`);
      }
      
      // Check if postgres service is running
      try {
        await execAsync(`docker compose -f ${composePath} ps postgres`);
      } catch (psError) {
        throw new Error('PostgreSQL container is not running. Start services with: docker-compose up -d');
      }
      
      // Try to use Docker first
      const dockerCommand = `docker compose -f ${composePath} exec -T postgres psql -U kick -d kickstack -v ON_ERROR_STOP=1 -f - < ${tempFile}`;
      const { stdout, stderr } = await execAsync(dockerCommand);
      
      if (stderr && stderr.includes('ERROR')) {
        throw new Error(`Migration SQL error: ${stderr}`);
      }
      
    } catch (dockerError: any) {
      console.warn('Docker execution failed, trying direct psql connection...');
      
      // Fallback to direct psql if Docker fails
      try {
        // Test connection first
        await execAsync(`psql "${this.connectionString}" -c "SELECT 1;"`);
        
        const psqlCommand = `psql "${this.connectionString}" -v ON_ERROR_STOP=1 -f ${tempFile}`;
        const { stdout, stderr } = await execAsync(psqlCommand);
        
        if (stderr && stderr.includes('ERROR')) {
          throw new Error(`Migration SQL error: ${stderr}`);
        }
        
      } catch (psqlError: any) {
        // Provide more helpful error messages
        let errorMessage = 'Migration failed: ';
        
        if (psqlError.message.includes('connection refused')) {
          errorMessage += 'Cannot connect to database. Make sure PostgreSQL is running and connection details are correct.';
        } else if (psqlError.message.includes('authentication failed')) {
          errorMessage += 'Database authentication failed. Check username and password.';
        } else if (psqlError.message.includes('database') && psqlError.message.includes('does not exist')) {
          errorMessage += 'Database "kickstack" does not exist. Create it or run initial setup.';
        } else {
          errorMessage += psqlError.message;
        }
        
        throw new Error(errorMessage);
      }
    } finally {
      // Clean up temp file
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up temp file ${tempFile}:`, cleanupError);
      }
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

  async runQuery(query: string): Promise<string> {
    try {
      // Check if Docker is available
      await execAsync('docker info');
      
      const composePath = path.join(__dirname, '../../../../infra/docker-compose.yml');
      
      // Try Docker first
      const dockerCommand = `docker compose -f ${composePath} exec -T postgres psql -U kick -d kickstack -t -c "${query.replace(/"/g, '\\"')}"`;
      const { stdout, stderr } = await execAsync(dockerCommand);
      
      if (stderr && stderr.includes('ERROR')) {
        throw new Error(`Database query error: ${stderr}`);
      }
      
      return stdout;
    } catch (dockerError: any) {
      // Fallback to direct psql
      try {
        const psqlCommand = `psql "${this.connectionString}" -t -c "${query.replace(/"/g, '\\"')}"`;
        const { stdout, stderr } = await execAsync(psqlCommand);
        
        if (stderr && stderr.includes('ERROR')) {
          throw new Error(`Database query error: ${stderr}`);
        }
        
        return stdout;
      } catch (psqlError: any) {
        // Provide more helpful error messages
        let errorMessage = 'Database query failed: ';
        
        if (psqlError.message.includes('connection refused')) {
          errorMessage += 'Cannot connect to database. Ensure PostgreSQL is running.';
        } else if (psqlError.message.includes('authentication failed')) {
          errorMessage += 'Authentication failed. Check database credentials.';
        } else if (psqlError.message.includes('does not exist')) {
          errorMessage += 'Database or table does not exist.';
        } else {
          errorMessage += psqlError.message;
        }
        
        throw new Error(errorMessage);
      }
    }
  }

  async runQueryBoolean(query: string): Promise<boolean> {
    const result = await this.runQuery(query);
    return result.toLowerCase().includes('t');
  }

  async runQueryJson(query: string): Promise<any> {
    try {
      // Try Docker first with JSON output
      const dockerCommand = `docker compose -f ${path.join(__dirname, '../../../../infra/docker-compose.yml')} exec -T postgres psql -U kick -d kickstack -t -A -c "${query.replace(/"/g, '\\"')}"`;
      const { stdout } = await execAsync(dockerCommand);
      
      // Parse the result assuming it's a single row with boolean columns
      const values = stdout.trim().split('|').map(v => v.trim() === 't');
      return {
        rows: [{
          has_auth_org: values[0],
          has_is_admin: values[1]
        }]
      };
    } catch (error) {
      // Fallback - return false for both
      return {
        rows: [{
          has_auth_org: false,
          has_is_admin: false
        }]
      };
    }
  }

  getConnectionString(): string {
    return this.connectionString;
  }
}