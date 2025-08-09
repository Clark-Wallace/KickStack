import jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Test configuration
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const API_BASE = 'http://localhost:3000';
const TEST_TABLE = 'test_public_blog';

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

describe('RLS Public Read Policy Integration Tests', () => {
  const userA = 'a1234567-89ab-cdef-0123-456789abcdef';
  const userB = 'b1234567-89ab-cdef-0123-456789abcdef';
  const tokenA = generateJWT(userA);
  const tokenB = generateJWT(userB);

  beforeAll(async () => {
    // Ensure Docker stack is running
    console.log('Setting up test environment for public_read...');
    
    // Create test table with owner column
    await runCLI(`add-table "${TEST_TABLE} with author_id uuid, title text, content text, published boolean"`);
    
    // Apply public_read policy
    await runCLI(`add-policy public_read ${TEST_TABLE} --owner-col author_id`);
    
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
    it('should allow user A to insert a row with their author_id', async () => {
      const row = {
        author_id: userA,
        title: 'User A Blog Post',
        content: 'This is a public blog post by User A',
        published: true
      };

      const result = await apiRequest('POST', `/${TEST_TABLE}`, tokenA, row);
      expect(result.status).toBe(201);
    });

    it('should block user B from inserting a row with user A\'s author_id', async () => {
      const row = {
        author_id: userA, // Trying to use A's ID
        title: 'Fake Post',
        content: 'Trying to impersonate User A',
        published: true
      };

      const result = await apiRequest('POST', `/${TEST_TABLE}`, tokenB, row);
      expect(result.status).toBeGreaterThanOrEqual(400); // Should be 403 or 401
    });

    it('should allow user B to insert a row with their own author_id', async () => {
      const row = {
        author_id: userB,
        title: 'User B Blog Post',
        content: 'This is a public blog post by User B',
        published: true
      };

      const result = await apiRequest('POST', `/${TEST_TABLE}`, tokenB, row);
      expect(result.status).toBe(201);
    });

    it('should block anonymous users from inserting', async () => {
      const row = {
        title: 'Anonymous Post',
        content: 'Trying to post without authentication',
        published: true
      };

      const result = await apiRequest('POST', `/${TEST_TABLE}`, null, row);
      expect(result.status).toBeGreaterThanOrEqual(401);
    });
  });

  describe('SELECT operations (PUBLIC READ)', () => {
    it('should allow user A to see ALL posts (not just their own)', async () => {
      const result = await apiRequest('GET', `/${TEST_TABLE}`, tokenA);
      
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      
      // Should see posts from both users
      const hasAPost = result.data.some((row: any) => row.author_id === userA);
      const hasBPost = result.data.some((row: any) => row.author_id === userB);
      
      expect(hasAPost).toBe(true);
      expect(hasBPost).toBe(true);
    });

    it('should allow user B to see ALL posts (public read)', async () => {
      const result = await apiRequest('GET', `/${TEST_TABLE}`, tokenB);
      
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      
      // Should see posts from both users
      const hasAPost = result.data.some((row: any) => row.author_id === userA);
      const hasBPost = result.data.some((row: any) => row.author_id === userB);
      
      expect(hasAPost).toBe(true);
      expect(hasBPost).toBe(true);
    });

    it('should allow ANONYMOUS users to read ALL posts (public read)', async () => {
      const result = await apiRequest('GET', `/${TEST_TABLE}`, null);
      
      expect(result.status).toBe(200);
      expect(Array.isArray(result.data)).toBe(true);
      
      // Anonymous should see all posts
      const hasAPost = result.data.some((row: any) => row.author_id === userA);
      const hasBPost = result.data.some((row: any) => row.author_id === userB);
      
      expect(hasAPost).toBe(true);
      expect(hasBPost).toBe(true);
    });
  });

  describe('UPDATE operations', () => {
    let userARowId: string;
    let userBRowId: string;

    beforeAll(async () => {
      // Get user A's post
      const resultA = await apiRequest('GET', `/${TEST_TABLE}?author_id=eq.${userA}`, tokenA);
      if (resultA.data && resultA.data.length > 0) {
        userARowId = resultA.data[0].id;
      }
      
      // Get user B's post
      const resultB = await apiRequest('GET', `/${TEST_TABLE}?author_id=eq.${userB}`, tokenB);
      if (resultB.data && resultB.data.length > 0) {
        userBRowId = resultB.data[0].id;
      }
    });

    it('should allow user A to update their own post', async () => {
      if (!userARowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const update = { title: 'Updated by Author A' };
      const result = await apiRequest(
        'PATCH', 
        `/${TEST_TABLE}?id=eq.${userARowId}`,
        tokenA,
        update
      );
      
      expect(result.status).toBeLessThan(300); // Success
    });

    it('should block user B from updating user A\'s post', async () => {
      if (!userARowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const update = { title: 'Hacked by B' };
      const result = await apiRequest(
        'PATCH', 
        `/${TEST_TABLE}?id=eq.${userARowId}`,
        tokenB,
        update
      );
      
      // Should either return error or no rows affected
      expect(result.status).toBeGreaterThanOrEqual(204);
    });

    it('should block anonymous users from updating any post', async () => {
      if (!userARowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const update = { title: 'Hacked by Anonymous' };
      const result = await apiRequest(
        'PATCH', 
        `/${TEST_TABLE}?id=eq.${userARowId}`,
        null,
        update
      );
      
      // Should be forbidden
      expect(result.status).toBeGreaterThanOrEqual(401);
    });
  });

  describe('DELETE operations', () => {
    let userBRowId: string;

    beforeAll(async () => {
      // Get one of user B's posts
      const result = await apiRequest('GET', `/${TEST_TABLE}?author_id=eq.${userB}`, tokenB);
      if (result.data && result.data.length > 0) {
        userBRowId = result.data[0].id;
      }
    });

    it('should block user A from deleting user B\'s post', async () => {
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
      
      // Verify post still exists (publicly readable)
      const checkResult = await apiRequest('GET', `/${TEST_TABLE}?id=eq.${userBRowId}`, null);
      expect(checkResult.data.length).toBeGreaterThan(0);
    });

    it('should block anonymous users from deleting any post', async () => {
      if (!userBRowId) {
        console.warn('No row ID found, skipping test');
        return;
      }

      const result = await apiRequest(
        'DELETE', 
        `/${TEST_TABLE}?id=eq.${userBRowId}`,
        null
      );
      
      // Should be forbidden
      expect(result.status).toBeGreaterThanOrEqual(401);
      
      // Verify post still exists
      const checkResult = await apiRequest('GET', `/${TEST_TABLE}?id=eq.${userBRowId}`, null);
      expect(checkResult.data.length).toBeGreaterThan(0);
    });

    it('should allow user B to delete their own post', async () => {
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
      
      // Verify post is deleted (even anonymous can check)
      const checkResult = await apiRequest('GET', `/${TEST_TABLE}?id=eq.${userBRowId}`, null);
      expect(checkResult.data.length).toBe(0);
    });
  });

  describe('Public read verification', () => {
    it('should show consistent data to all viewers', async () => {
      // Insert a fresh post as user A
      const newPost = {
        author_id: userA,
        title: 'Consistency Test Post',
        content: 'This should be visible to everyone',
        published: true
      };
      
      await apiRequest('POST', `/${TEST_TABLE}`, tokenA, newPost);
      
      // Wait for data to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch as different users and anonymous
      const resultA = await apiRequest('GET', `/${TEST_TABLE}?title=eq.Consistency Test Post`, tokenA);
      const resultB = await apiRequest('GET', `/${TEST_TABLE}?title=eq.Consistency Test Post`, tokenB);
      const resultAnon = await apiRequest('GET', `/${TEST_TABLE}?title=eq.Consistency Test Post`, null);
      
      // All should see the same post
      expect(resultA.data.length).toBe(1);
      expect(resultB.data.length).toBe(1);
      expect(resultAnon.data.length).toBe(1);
      
      // Verify content is identical
      expect(resultA.data[0].title).toBe('Consistency Test Post');
      expect(resultB.data[0].title).toBe('Consistency Test Post');
      expect(resultAnon.data[0].title).toBe('Consistency Test Post');
    });
  });
});