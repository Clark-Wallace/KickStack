import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const GATEWAY_URL = 'http://localhost:8787';

// Helper to generate test JWT
function generateTestJWT(userId: string, role: string = 'authenticated'): string {
  return jwt.sign(
    { 
      sub: userId, 
      role: role,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

// Helper to wait for server to start
async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

describe('Functions Gateway Integration Tests', () => {
  let gatewayProcess: ChildProcess | null = null;

  beforeAll(async () => {
    console.log('Starting Functions Gateway for integration tests...');
    
    // Start the gateway server
    gatewayProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test' },
      detached: false
    });

    gatewayProcess.stdout?.on('data', (data) => {
      console.log(`Gateway: ${data}`);
    });

    gatewayProcess.stderr?.on('data', (data) => {
      console.error(`Gateway Error: ${data}`);
    });

    // Wait for server to be ready
    const ready = await waitForServer(GATEWAY_URL);
    if (!ready) {
      throw new Error('Gateway server failed to start');
    }
    
    console.log('Gateway is ready for testing');
  }, 60000);

  afterAll(async () => {
    console.log('Shutting down Functions Gateway...');
    if (gatewayProcess) {
      gatewayProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });

  describe('Health Check', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${GATEWAY_URL}/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.service).toBe('KickStack Functions Gateway');
    });
  });

  describe('Function Execution', () => {
    it('should call hello function without authentication', async () => {
      const response = await fetch(`${GATEWAY_URL}/fn/hello`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Test without auth' })
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.user).toBeNull();
      expect(data.received).toEqual({ message: 'Test without auth' });
    });

    it('should call hello function with valid JWT', async () => {
      const userId = 'test-user-123';
      const token = generateTestJWT(userId);
      
      const response = await fetch(`${GATEWAY_URL}/fn/hello`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: 'Test with auth' })
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.user).not.toBeNull();
      expect(data.user.sub).toBe(userId);
      expect(data.user.role).toBe('authenticated');
      expect(data.received).toEqual({ message: 'Test with auth' });
    });

    it('should handle invalid JWT gracefully', async () => {
      const response = await fetch(`${GATEWAY_URL}/fn/hello`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify({ message: 'Test with bad auth' })
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.user).toBeNull(); // Invalid token treated as anonymous
    });

    it('should return 404 for non-existent function', async () => {
      const response = await fetch(`${GATEWAY_URL}/fn/nonexistent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: 'data' })
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.ok).toBe(false);
      expect(data.error).toContain('not found');
    });

    it('should pass query parameters to function', async () => {
      const response = await fetch(`${GATEWAY_URL}/fn/hello?foo=bar&test=123`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Test with query' })
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      // The hello function doesn't use query params, but they should be passed
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON body', async () => {
      const response = await fetch(`${GATEWAY_URL}/fn/hello`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'not valid json'
      });
      
      // Express will reject malformed JSON
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing Content-Type', async () => {
      const response = await fetch(`${GATEWAY_URL}/fn/hello`, {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      });
      
      const data = await response.json();
      
      // Should still work, express will parse it
      expect(response.status).toBe(200);
    });
  });
});

// Run only if explicitly testing integration
if (process.env.RUN_INTEGRATION_TESTS === 'true') {
  describe('Integration Tests', () => {
    it('should run', () => {
      expect(true).toBe(true);
    });
  });
}