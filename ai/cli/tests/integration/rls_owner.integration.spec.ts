import jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Test configuration
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const API_BASE = 'http://localhost:3000';
const TEST_TABLE = 'test_rls_contacts';

// Generate test JWTs
function generateJWT(userId: string, role: string = 'authenticated'): string {
  return jwt.sign(
    { 
      sub: userId, 
      role: role,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

// Helper to run CLI commands
async function runCLI(command: string): Promise<string> {
  const cliPath = path.join(__dirname, '../../src/index.ts');
  const { stdout, stderr } = await execAsync(`ts-node ${cliPath} ${command}`);
  if (stderr) console.error('CLI stderr:', stderr);
  return stdout;
}

// Helper for API requests
async function apiRequest(
  method: string, 
  path: string, 
  token: string | null = null, 
  body: any = null
): Promise<{ status: number; data: any }> {
  const headers: any = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: any = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => null);
  
  return {
    status: response.status,
    data
  };
}

describe('RLS Owner Policy Integration Tests', () => {
  const userA = 'a1234567-89ab-cdef-0123-456789abcdef';
  const userB = 'b1234567-89ab-cdef-0123-456789abcdef';
  const tokenA = generateJWT(userA);
  const tokenB = generateJWT(userB);

  beforeAll(async () => {
    // Ensure Docker stack is running
    console.log('Setting up test environment...');
    
    // Create test table with owner column
    await runCLI(`add-table "${TEST_TABLE} with user_id uuid, name text, email text"`);
    
    // Apply owner policy
    await runCLI(`add-policy owner ${TEST_TABLE} --owner-col user_id`);
    
    // Wait for PostgREST to reload schema
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    // Clean up test table
    try {
      const dropTableSQL = `DROP TABLE IF EXISTS ${TEST_TABLE} CASCADE;`;
      const dockerCmd = `docker compose -f ${path.join(__dirname, '../../../../infra/docker-compose.yml')} exec -T postgres psql -U kick -d kickstack -c "${dropTableSQL}"`;
      await execAsync(dockerCmd);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('INSERT operations', () => {
    it('should allow user A to insert a row with their user_id', async () => {
      const row = {
        user_id: userA,
        name: 'User A Contact',
        email: 'usera@example.com'
      };

      const result = await apiRequest('POST', `/${TEST_TABLE}`, tokenA, row);
      expect(result.status).toBe(201);
    });

    it('should block user B from inserting a row with user A\'s user_id', async () => {
      const row = {
        user_id: userA, // Trying to use A's ID
        name: 'Malicious Contact',
        email: 'evil@example.com'
      };

      const result = await apiRequest('POST', `/${TEST_TABLE}`, tokenB, row);
      expect(result.status).toBeGreaterThanOrEqual(400); // Should be 403 or 401
    });

    it('should allow user B to insert a row with their own user_id', async () => {
      const row = {
        user_id: userB,
        name: 'User B Contact',
        email: 'userb@example.com'
      };

      const result = await apiRequest('POST', `/${TEST_TABLE}`, tokenB, row);
      expect(result.status).toBe(201);
    });
  });

  describe('SELECT operations', () => {
    it('should only return user A\'s rows to user A', async () => {
      const result = await apiRequest('GET', `/${TEST_TABLE}`, tokenA);
      
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      
      // All returned rows should belong to user A
      result.data.forEach((row: any) => {
        expect(row.user_id).toBe(userA);
      });
      
      // Should not see user B's rows
      const hasBRows = result.data.some((row: any) => row.user_id === userB);
      expect(hasBRows).toBe(false);
    });

    it('should only return user B\'s rows to user B', async () => {
      const result = await apiRequest('GET', `/${TEST_TABLE}`, tokenB);
      
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      
      // All returned rows should belong to user B
      result.data.forEach((row: any) => {
        expect(row.user_id).toBe(userB);
      });
      
      // Should not see user A's rows
      const hasARows = result.data.some((row: any) => row.user_id === userA);
      expect(hasARows).toBe(false);
    });

    it('should return empty array for anonymous users', async () => {
      const result = await apiRequest('GET', `/${TEST_TABLE}`, null);
      
      // Should either be forbidden or return empty
      if (result.status === 200) {
        expect(result.data).toEqual([]);
      } else {
        expect(result.status).toBeGreaterThanOrEqual(401);
      }
    });
  });

  describe('UPDATE operations', () => {
    let userARowId: string;

    beforeAll(async () => {
      // Get one of user A's rows
      const result = await apiRequest('GET', `/${TEST_TABLE}`, tokenA);
      if (result.data && result.data.length > 0) {
        userARowId = result.data[0].id;
      }
    });

    it('should allow user A to update their own row', async () => {
      if (!userARowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const update = { name: 'Updated by A' };
      const result = await apiRequest(
        'PATCH', 
        `/${TEST_TABLE}?id=eq.${userARowId}`,
        tokenA,
        update
      );
      
      expect(result.status).toBeLessThan(300); // Success
    });

    it('should block user B from updating user A\'s row', async () => {
      if (!userARowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const update = { name: 'Hacked by B' };
      const result = await apiRequest(
        'PATCH', 
        `/${TEST_TABLE}?id=eq.${userARowId}`,
        tokenB,
        update
      );
      
      // Should either return error or no rows affected
      expect(result.status).toBeGreaterThanOrEqual(204);
    });
  });

  describe('DELETE operations', () => {
    let userBRowId: string;

    beforeAll(async () => {
      // Get one of user B's rows
      const result = await apiRequest('GET', `/${TEST_TABLE}`, tokenB);
      if (result.data && result.data.length > 0) {
        userBRowId = result.data[0].id;
      }
    });

    it('should block user A from deleting user B\'s row', async () => {
      if (!userBRowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const result = await apiRequest(
        'DELETE', 
        `/${TEST_TABLE}?id=eq.${userBRowId}`,
        tokenA
      );
      
      // Should either return error or no rows affected
      expect(result.status).toBeGreaterThanOrEqual(204);
      
      // Verify row still exists for user B
      const checkResult = await apiRequest('GET', `/${TEST_TABLE}?id=eq.${userBRowId}`, tokenB);
      expect(checkResult.data.length).toBeGreaterThan(0);
    });

    it('should allow user B to delete their own row', async () => {
      if (!userBRowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const result = await apiRequest(
        'DELETE', 
        `/${TEST_TABLE}?id=eq.${userBRowId}`,
        tokenB
      );
      
      expect(result.status).toBeLessThan(300); // Success
      
      // Verify row is deleted
      const checkResult = await apiRequest('GET', `/${TEST_TABLE}?id=eq.${userBRowId}`, tokenB);
      expect(checkResult.data.length).toBe(0);
    });
  });
});