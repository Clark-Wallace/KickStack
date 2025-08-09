import { Plan, VerifyResult, VerificationCheck } from './types';
import chalk from 'chalk';
import jwt from 'jsonwebtoken';

export class VerifyService {
  private readonly API_BASE = 'http://localhost:3000';
  private readonly AUTH_BASE = 'http://localhost:9999';
  private readonly FNGW_BASE = 'http://localhost:8787';
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'changeme';

  async verify(plan: Plan): Promise<VerifyResult> {
    console.log(chalk.blue('🔍 Verifying deployment...'));
    
    const result: VerifyResult = {
      success: true,
      passed: [],
      failed: [],
      errors: []
    };

    try {
      // 1. Connectivity checks
      await this.verifyConnectivity(result);

      // 2. RLS spot checks
      await this.verifyRLS(plan, result);

      // 3. Function smoke tests
      await this.verifyFunctions(plan, result);

      // 4. Custom verification checks from plan
      if (plan.verification?.smoke) {
        await this.verifyCustomChecks(plan.verification.smoke, result);
      }

      result.success = result.failed.length === 0;
      
      // Print results
      this.printResults(result);
      
      return result;

    } catch (error) {
      console.error(chalk.red('Verification failed:'), error);
      result.success = false;
      result.errors?.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  private async verifyConnectivity(result: VerifyResult): Promise<void> {
    console.log(chalk.gray('  Checking service connectivity...'));
    
    // Check PostgREST API
    try {
      const response = await fetch(`${this.API_BASE}/`);
      if (response.ok) {
        result.passed.push('PostgREST API connectivity');
      } else {
        result.failed.push('PostgREST API not responding');
      }
    } catch (error) {
      result.failed.push('PostgREST API not reachable');
    }

    // Check GoTrue Auth
    try {
      const response = await fetch(`${this.AUTH_BASE}/health`);
      if (response.ok) {
        result.passed.push('GoTrue Auth connectivity');
      } else {
        result.failed.push('GoTrue Auth not responding');
      }
    } catch (error) {
      result.failed.push('GoTrue Auth not reachable');
    }

    // Check Functions Gateway
    try {
      const response = await fetch(`${this.FNGW_BASE}/health`);
      if (response.ok) {
        result.passed.push('Functions Gateway connectivity');
      } else {
        result.failed.push('Functions Gateway not responding');
      }
    } catch (error) {
      result.failed.push('Functions Gateway not reachable');
    }
  }

  private async verifyRLS(plan: Plan, result: VerifyResult): Promise<void> {
    console.log(chalk.gray('  Checking RLS policies...'));
    
    // Generate test tokens
    const userA = 'test-user-a-' + Date.now();
    const userB = 'test-user-b-' + Date.now();
    const tokenA = this.generateTestToken(userA);
    const tokenB = this.generateTestToken(userB);

    for (const step of plan.steps) {
      if (step.kind !== 'table' || !step.policy) continue;
      
      const tableName = step.name;
      const { preset } = step.policy;

      if (preset === 'public_read') {
        // Test anonymous read access
        try {
          const response = await fetch(`${this.API_BASE}/${tableName}`);
          if (response.ok) {
            result.passed.push(`${tableName}: anonymous read access`);
          } else {
            result.failed.push(`${tableName}: anonymous read access blocked`);
          }
        } catch (error) {
          result.failed.push(`${tableName}: anonymous read test failed`);
        }

        // Test authenticated write access (should work)
        try {
          const testData = this.generateTestRowData(step, userA);
          const response = await fetch(`${this.API_BASE}/${tableName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify(testData)
          });
          
          if (response.status === 201) {
            result.passed.push(`${tableName}: authenticated write access`);
          } else {
            result.failed.push(`${tableName}: authenticated write access blocked`);
          }
        } catch (error) {
          result.failed.push(`${tableName}: authenticated write test failed`);
        }

      } else if (preset === 'owner') {
        // Test that user A cannot read user B's data
        try {
          // First, try to insert as user B
          const testData = this.generateTestRowData(step, userB);
          const insertResponse = await fetch(`${this.API_BASE}/${tableName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenB}`
            },
            body: JSON.stringify(testData)
          });
          
          // Then try to read as user A
          const readResponse = await fetch(`${this.API_BASE}/${tableName}`, {
            headers: {
              'Authorization': `Bearer ${tokenA}`
            }
          });
          
          if (readResponse.ok) {
            const data = await readResponse.json();
            const hasBData = data.some((row: any) => row[step.policy!.owner_col] === userB);
            
            if (!hasBData) {
              result.passed.push(`${tableName}: owner isolation working`);
            } else {
              result.failed.push(`${tableName}: owner isolation not working`);
            }
          } else {
            result.failed.push(`${tableName}: owner read test failed`);
          }
        } catch (error) {
          result.failed.push(`${tableName}: owner isolation test failed`);
        }
      }
    }
  }

  private async verifyFunctions(plan: Plan, result: VerifyResult): Promise<void> {
    console.log(chalk.gray('  Checking edge functions...'));
    
    for (const step of plan.steps) {
      if (step.kind !== 'function') continue;
      
      const funcName = step.name;
      
      try {
        const response = await fetch(`${this.FNGW_BASE}/fn/${funcName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ dryRun: true, test: 'verification' })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.ok) {
            result.passed.push(`Function ${funcName}: smoke test passed`);
          } else {
            result.failed.push(`Function ${funcName}: returned error`);
          }
        } else {
          result.failed.push(`Function ${funcName}: HTTP ${response.status}`);
        }
      } catch (error) {
        result.failed.push(`Function ${funcName}: connectivity failed`);
      }
    }
  }

  private async verifyCustomChecks(checks: VerificationCheck[], result: VerifyResult): Promise<void> {
    console.log(chalk.gray('  Running custom verification checks...'));
    
    for (const check of checks) {
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        // Handle token placeholders
        if (check.token) {
          if (check.token === '$TOKEN_A') {
            headers['Authorization'] = `Bearer ${this.generateTestToken('test-user-a')}`;
          } else if (check.token === '$TOKEN_B') {
            headers['Authorization'] = `Bearer ${this.generateTestToken('test-user-b')}`;
          } else {
            headers['Authorization'] = `Bearer ${check.token}`;
          }
        }
        
        const requestOptions: RequestInit = {
          method: check.method,
          headers
        };
        
        if (check.body) {
          requestOptions.body = JSON.stringify(check.body);
        }
        
        const response = await fetch(`${this.API_BASE}${check.path}`, requestOptions);
        
        if (response.status === check.expect) {
          result.passed.push(`Custom check: ${check.method} ${check.path} → ${check.expect}`);
        } else {
          result.failed.push(`Custom check: ${check.method} ${check.path} → expected ${check.expect}, got ${response.status}`);
        }
        
      } catch (error) {
        result.failed.push(`Custom check: ${check.method} ${check.path} → error`);
      }
    }
  }

  private generateTestToken(userId: string): string {
    return jwt.sign(
      {
        sub: userId,
        role: 'authenticated',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      this.JWT_SECRET,
      { algorithm: 'HS256' }
    );
  }

  private generateTestRowData(step: any, userId: string): any {
    const data: any = {};
    
    for (const col of step.columns) {
      if (col.pk || col.default) continue;
      
      if (col.name === step.policy?.owner_col) {
        data[col.name] = userId;
      } else if (col.type.toLowerCase().includes('text')) {
        data[col.name] = `test-${col.name}-${Date.now()}`;
      } else if (col.type.toLowerCase().includes('int')) {
        data[col.name] = Math.floor(Math.random() * 1000);
      } else if (col.type.toLowerCase().includes('bool')) {
        data[col.name] = Math.random() > 0.5;
      } else if (col.type.toLowerCase() === 'uuid') {
        // Generate a simple UUID-like string
        data[col.name] = 'test-' + Math.random().toString(36).substr(2, 9);
      }
    }
    
    return data;
  }

  private printResults(result: VerifyResult): void {
    console.log(chalk.white('\n🔍 Verification Results'));
    console.log(chalk.gray('─'.repeat(50)));
    
    if (result.passed.length > 0) {
      console.log(chalk.green('\n✓ Passed:'));
      result.passed.forEach(check => {
        console.log(chalk.gray(`  • ${check}`));
      });
    }
    
    if (result.failed.length > 0) {
      console.log(chalk.red('\n✗ Failed:'));
      result.failed.forEach(check => {
        console.log(chalk.gray(`  • ${check}`));
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(chalk.red('\n⚠ Errors:'));
      result.errors.forEach(error => {
        console.log(chalk.gray(`  • ${error}`));
      });
    }
    
    console.log(chalk.gray('─'.repeat(50)));
    
    if (result.success) {
      console.log(chalk.green('✅ All verifications passed!'));
    } else {
      console.log(chalk.red('❌ Some verifications failed'));
      console.log(chalk.yellow('\n💡 To rollback: kickstack rollback --last'));
    }
  }
}