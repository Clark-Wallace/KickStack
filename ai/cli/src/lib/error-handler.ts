import * as fs from 'fs';
import * as path from 'path';

export enum ErrorType {
  DOCKER_NOT_RUNNING = 'DOCKER_NOT_RUNNING',
  SERVICE_NOT_RUNNING = 'SERVICE_NOT_RUNNING', 
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  DATABASE_AUTH = 'DATABASE_AUTH',
  DATABASE_MISSING = 'DATABASE_MISSING',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  MIGRATION_ERROR = 'MIGRATION_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface KickStackError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  suggestions?: string[];
  context?: Record<string, any>;
}

export class ErrorHandler {
  
  static categorizeError(error: Error, context?: Record<string, any>): KickStackError {
    const message = error.message.toLowerCase();
    
    // Docker-related errors
    if (message.includes('docker') && message.includes('not running')) {
      return {
        type: ErrorType.DOCKER_NOT_RUNNING,
        message: 'Docker is not running',
        originalError: error,
        suggestions: [
          'Start Docker Desktop',
          'Verify Docker installation: docker --version',
          'Check Docker daemon status'
        ],
        context
      };
    }
    
    if (message.includes('container') && message.includes('not running')) {
      return {
        type: ErrorType.SERVICE_NOT_RUNNING,
        message: 'Required service is not running',
        originalError: error,
        suggestions: [
          'Start services: cd infra && docker-compose up -d',
          'Check service status: docker-compose ps',
          'View service logs: docker-compose logs <service-name>'
        ],
        context
      };
    }
    
    // Database connection errors
    if (message.includes('connection refused') || message.includes('could not connect')) {
      return {
        type: ErrorType.DATABASE_CONNECTION,
        message: 'Cannot connect to PostgreSQL database',
        originalError: error,
        suggestions: [
          'Ensure PostgreSQL is running: docker-compose up -d postgres',
          'Check connection string in .env file',
          'Verify database port (default: 5432)',
          'Run setup validation: ./scripts/validate-setup.sh'
        ],
        context
      };
    }
    
    if (message.includes('authentication failed') || message.includes('password authentication')) {
      return {
        type: ErrorType.DATABASE_AUTH,
        message: 'Database authentication failed',
        originalError: error,
        suggestions: [
          'Check database credentials (username: kick, password: kickpass)',
          'Verify KICKSTACK_PG_URI environment variable',
          'Reset database: docker-compose down -v && docker-compose up -d'
        ],
        context
      };
    }
    
    if (message.includes('database') && message.includes('does not exist')) {
      return {
        type: ErrorType.DATABASE_MISSING,
        message: 'Database "kickstack" does not exist',
        originalError: error,
        suggestions: [
          'Initialize database: docker-compose up -d postgres',
          'Run database setup: psql -c "CREATE DATABASE kickstack;"',
          'Check initialization scripts in infra/init/'
        ],
        context
      };
    }
    
    // File system errors
    if (message.includes('no such file') || message.includes('enoent')) {
      return {
        type: ErrorType.FILE_NOT_FOUND,
        message: 'Required file or directory not found',
        originalError: error,
        suggestions: [
          'Verify you are in the KickStack project root',
          'Check file paths in commands',
          'Ensure project structure is intact'
        ],
        context
      };
    }
    
    if (message.includes('permission denied') || message.includes('eacces')) {
      return {
        type: ErrorType.PERMISSION_DENIED,
        message: 'Permission denied',
        originalError: error,
        suggestions: [
          'Check file permissions: ls -la',
          'Make script executable: chmod +x <script>',
          'Run with appropriate privileges if needed'
        ],
        context
      };
    }
    
    // SQL/Migration errors
    if (message.includes('syntax error') || message.includes('invalid syntax')) {
      return {
        type: ErrorType.INVALID_SYNTAX,
        message: 'SQL syntax error in query or migration',
        originalError: error,
        suggestions: [
          'Check SQL syntax in migration files',
          'Validate query structure',
          'Test SQL in database client first'
        ],
        context
      };
    }
    
    if (message.includes('migration') && message.includes('failed')) {
      return {
        type: ErrorType.MIGRATION_ERROR,
        message: 'Database migration failed',
        originalError: error,
        suggestions: [
          'Check migration SQL for errors',
          'Verify database connection',
          'Roll back problematic changes',
          'Check logs: docker-compose logs postgres'
        ],
        context
      };
    }
    
    // Template errors
    if (message.includes('template') || message.includes('manifest')) {
      return {
        type: ErrorType.TEMPLATE_ERROR,
        message: 'Template processing error',
        originalError: error,
        suggestions: [
          'Verify template manifest.yaml structure',
          'Check template file paths',
          'Validate template syntax'
        ],
        context
      };
    }
    
    // Default case
    return {
      type: ErrorType.UNKNOWN,
      message: error.message,
      originalError: error,
      suggestions: [
        'Check the full error message for specific details',
        'Run diagnostic: ./scripts/debug-services.sh',
        'Check service logs: docker-compose logs',
        'Validate setup: ./scripts/validate-setup.sh'
      ],
      context
    };
  }
  
  static formatError(kickStackError: KickStackError): string {
    const { type, message, suggestions, context } = kickStackError;
    
    let output = `\n❌ KickStack Error [${type}]\n`;
    output += `   ${message}\n`;
    
    if (context && Object.keys(context).length > 0) {
      output += `\n📋 Context:\n`;
      Object.entries(context).forEach(([key, value]) => {
        output += `   ${key}: ${value}\n`;
      });
    }
    
    if (suggestions && suggestions.length > 0) {
      output += `\n🔧 Suggested fixes:\n`;
      suggestions.forEach(suggestion => {
        output += `   • ${suggestion}\n`;
      });
    }
    
    output += `\n💡 Need more help?\n`;
    output += `   • Run diagnostics: ./scripts/debug-services.sh\n`;
    output += `   • Check setup: ./scripts/validate-setup.sh\n`;
    output += `   • View documentation: README.md\n`;
    
    return output;
  }
  
  static handleError(error: Error, context?: Record<string, any>): never {
    const kickStackError = this.categorizeError(error, context);
    const formattedError = this.formatError(kickStackError);
    
    console.error(formattedError);
    process.exit(1);
  }
  
  static logWarning(message: string, suggestions?: string[]): void {
    console.warn(`\n⚠️  Warning: ${message}`);
    
    if (suggestions && suggestions.length > 0) {
      console.warn(`\n💡 Recommendations:`);
      suggestions.forEach(suggestion => {
        console.warn(`   • ${suggestion}`);
      });
    }
    console.warn('');
  }
  
  static async validateEnvironment(): Promise<void> {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check if we're in KickStack project root - be more flexible
    const projectRoot = process.cwd();
    let infraPath = path.join(projectRoot, 'infra', 'docker-compose.yml');
    
    // Try various possible locations
    if (!fs.existsSync(infraPath)) {
      infraPath = path.join(projectRoot, '..', '..', 'infra', 'docker-compose.yml');
      if (!fs.existsSync(infraPath)) {
        infraPath = path.join(projectRoot, '..', 'infra', 'docker-compose.yml');
        if (!fs.existsSync(infraPath)) {
          // Only warn, don't fail
          warnings.push('Not in KickStack project root (infra/docker-compose.yml not found)');
        }
      }
    }
    
    // Check Docker availability
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('docker info');
    } catch (error) {
      issues.push('Docker is not running or not installed');
    }
    
    // Check environment file
    const envPath = path.join(projectRoot, 'infra', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('JWT_SECRET=changeme') || 
          envContent.includes('supersecretjwttokenchangemeforproduction')) {
        warnings.push('JWT_SECRET should be changed for security');
      }
      
      if (envContent.includes('MINIO_ROOT_PASSWORD=changeme123')) {
        warnings.push('MinIO credentials should be changed for security');
      }
    } else {
      warnings.push('.env file not found - using default configuration');
    }
    
    // Report issues
    if (issues.length > 0) {
      const error = new Error(`Environment validation failed:\n${issues.join('\n')}`);
      this.handleError(error, { issues, warnings });
    }
    
    if (warnings.length > 0) {
      this.logWarning('Environment validation warnings detected', warnings);
    }
  }
}