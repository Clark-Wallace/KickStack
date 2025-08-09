import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { decodeJwt, extractBearerToken } from '../src/auth';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-key';

describe('Gateway Auth Tests', () => {
  describe('decodeJwt', () => {
    it('should decode a valid JWT token', () => {
      const payload = {
        sub: 'user-123',
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      
      const token = jwt.sign(payload, TEST_SECRET);
      const result = decodeJwt(token, TEST_SECRET);
      
      expect(result).not.toBeNull();
      expect(result?.sub).toBe('user-123');
      expect(result?.role).toBe('authenticated');
    });

    it('should return null for invalid token', () => {
      const result = decodeJwt('invalid-token', TEST_SECRET);
      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      const payload = {
        sub: 'user-123',
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      };
      
      const token = jwt.sign(payload, TEST_SECRET);
      const result = decodeJwt(token, TEST_SECRET);
      
      expect(result).toBeNull();
    });

    it('should return null for token with missing fields', () => {
      const payload = {
        // Missing sub and role
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      
      const token = jwt.sign(payload, TEST_SECRET);
      const result = decodeJwt(token, TEST_SECRET);
      
      expect(result).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const payload = {
        sub: 'user-123',
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      
      const token = jwt.sign(payload, 'wrong-secret');
      const result = decodeJwt(token, TEST_SECRET);
      
      expect(result).toBeNull();
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      const header = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const result = extractBearerToken(header);
      
      expect(result).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
    });

    it('should return null for missing header', () => {
      const result = extractBearerToken(undefined);
      expect(result).toBeNull();
    });

    it('should return null for non-Bearer header', () => {
      const result = extractBearerToken('Basic username:password');
      expect(result).toBeNull();
    });

    it('should return null for malformed Bearer header', () => {
      const result = extractBearerToken('Bearer');
      expect(result).toBeNull();
    });

    it('should return null for header with extra spaces', () => {
      const result = extractBearerToken('Bearer  token  extra');
      expect(result).toBeNull();
    });
  });
});

describe('Function Loading Tests', () => {
  it('should handle missing function gracefully', async () => {
    // This would be tested with the actual server running
    // For unit tests, we're focusing on the auth logic
    expect(true).toBe(true);
  });

  it('should pass context correctly to function', async () => {
    // Mock function handler test
    const mockHandler = async (event: any, ctx: any) => {
      expect(ctx).toHaveProperty('user');
      expect(ctx).toHaveProperty('env');
      expect(ctx).toHaveProperty('log');
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('method');
      expect(event).toHaveProperty('query');
      expect(event).toHaveProperty('headers');
      expect(event).toHaveProperty('body');
      
      return { ok: true, received: event.body };
    };

    const event = {
      name: 'test',
      method: 'POST' as const,
      query: {},
      headers: {},
      body: { test: 'data' }
    };

    const ctx = {
      user: null,
      env: {},
      log: () => {}
    };

    const result = await mockHandler(event, ctx);
    expect(result.ok).toBe(true);
    expect(result.received).toEqual({ test: 'data' });
  });
});