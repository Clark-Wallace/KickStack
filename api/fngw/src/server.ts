import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { decodeJwt, extractBearerToken } from './auth';
import dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '../../../infra/.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const app = express();
const PORT = process.env.FNGW_PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const FUNCTIONS_DIR = path.join(__dirname, '../../functions');

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'KickStack Functions Gateway' });
});

// Main function handler
app.post('/fn/:name', async (req, res) => {
  const functionName = req.params.name;
  
  try {
    // Build the function path
    const tsPath = path.join(FUNCTIONS_DIR, `${functionName}.ts`);
    const jsPath = path.join(FUNCTIONS_DIR, `${functionName}.js`);
    
    let functionPath: string | null = null;
    if (fs.existsSync(tsPath)) {
      functionPath = tsPath;
    } else if (fs.existsSync(jsPath)) {
      functionPath = jsPath;
    }
    
    if (!functionPath) {
      return res.status(404).json({
        ok: false,
        error: `Function '${functionName}' not found`
      });
    }
    
    // Hot reload in development
    if (process.env.NODE_ENV !== 'production') {
      // Clear from require cache for hot reload
      delete require.cache[require.resolve(functionPath)];
      
      // Also clear the compiled JS if using TS
      if (functionPath.endsWith('.ts')) {
        const compiledPath = functionPath.replace('.ts', '.js');
        if (require.cache[compiledPath]) {
          delete require.cache[compiledPath];
        }
      }
    }
    
    // Load the function module
    let functionModule;
    try {
      // Use tsx/ts-node runtime for TypeScript files
      if (functionPath.endsWith('.ts')) {
        require('tsx/cjs');
      }
      functionModule = require(functionPath);
    } catch (loadError: any) {
      console.error(`Failed to load function ${functionName}:`, loadError);
      return res.status(500).json({
        ok: false,
        error: `Failed to load function: ${loadError.message}`
      });
    }
    
    const handler = functionModule.default || functionModule;
    
    if (typeof handler !== 'function') {
      return res.status(500).json({
        ok: false,
        error: `Function '${functionName}' does not export a valid handler`
      });
    }
    
    // Extract and decode JWT if present
    const token = extractBearerToken(req.headers.authorization);
    const user = token ? decodeJwt(token, JWT_SECRET) : null;
    
    // Build context
    const context = {
      user,
      env: Object.entries(process.env)
        .filter(([key]) => key.startsWith('KICKSTACK_FN_'))
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string | undefined>),
      log: (...args: any[]) => {
        console.log(`[${functionName}]`, ...args);
      }
    };
    
    // Build event
    const event = {
      name: functionName,
      method: 'POST' as const,
      query: req.query as Record<string, string>,
      headers: req.headers as Record<string, string>,
      body: req.body
    };
    
    // Execute the function
    const result = await handler(event, context);
    
    // Return the result
    res.json(result);
    
  } catch (error: any) {
    console.error(`Function '${functionName}' error:`, error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Internal function error'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 KickStack Functions Gateway running on http://localhost:${PORT}`);
  console.log(`📁 Loading functions from: ${FUNCTIONS_DIR}`);
  console.log(`🔑 JWT validation: ${JWT_SECRET === 'changeme' ? 'using default secret' : 'configured'}`);
});