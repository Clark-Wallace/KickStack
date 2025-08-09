import express from 'express';
import cors from 'cors';
import { TemplateManager } from '../../../ai/cli/src/lib/template-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import jwt from 'jsonwebtoken';
import demosRouter from './routes/demos';

const app = express();
const PORT = process.env.DASHBOARD_API_PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Template manager instance
const templateManager = new TemplateManager();

// Middleware
app.use(cors());
app.use(express.json());

// JWT middleware for protected routes
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Cache for template index (5 minutes)
let indexCache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// GET /api/templates/index - Get template index with caching
app.get('/api/templates/index', async (req, res) => {
  try {
    // Check cache
    if (indexCache && Date.now() - indexCache.timestamp < CACHE_DURATION) {
      return res.json(indexCache.data);
    }

    // Fetch fresh index
    const templates = await templateManager.getTemplateIndex();
    
    // Update cache
    indexCache = {
      data: templates,
      timestamp: Date.now()
    };

    res.json(templates);
  } catch (error) {
    console.error('Error fetching template index:', error);
    res.status(500).json({ error: 'Failed to fetch template index' });
  }
});

// GET /api/templates/search - Search templates with filters
app.get('/api/templates/search', async (req, res) => {
  try {
    const { q, category, tag, verifiedOnly } = req.query;
    
    const options = {
      category: category as string,
      tag: tag as string,
      verifiedOnly: verifiedOnly === 'true'
    };

    const results = await templateManager.searchTemplates(q as string, options);
    res.json(results);
  } catch (error) {
    console.error('Error searching templates:', error);
    res.status(500).json({ error: 'Failed to search templates' });
  }
});

// GET /api/templates/:name - Get template details
app.get('/api/templates/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    // Get template info
    const info = await templateManager.getTemplateInfo(name);
    
    // Try to get README (mock for now, would need to download/cache)
    const readme = await getTemplateReadme(name);
    
    res.json({
      ...info,
      readme
    });
  } catch (error) {
    console.error('Error fetching template details:', error);
    res.status(404).json({ error: 'Template not found' });
  }
});

// POST /api/templates/install - Install a template (requires auth)
app.post('/api/templates/install', authenticate, async (req, res) => {
  try {
    const { name, mode = 'stage', force = false } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Log the installation attempt
    console.log(`Installing template ${name} (mode: ${mode}, force: ${force}) by user ${req.user.sub}`);

    // Install template
    const result = await templateManager.installTemplate(name, {
      apply: mode === 'apply',
      force
    });

    // Prepare response with operation details
    const response = {
      success: true,
      name,
      mode,
      result: {
        migrations: result.migrations.map(f => path.relative(process.cwd(), f)),
        functions: result.functions.map(f => path.relative(process.cwd(), f)),
        assets: result.assets.map(f => path.relative(process.cwd(), f))
      },
      message: mode === 'apply' 
        ? `Template ${name} installed and applied successfully`
        : `Template ${name} staged successfully. Review files in _staged/ directories.`
    };

    res.json(response);
  } catch (error) {
    console.error('Error installing template:', error);
    res.status(500).json({ 
      error: 'Failed to install template',
      details: error.message 
    });
  }
});

// GET /api/templates/installed - Get list of installed templates
app.get('/api/templates/installed', async (req, res) => {
  try {
    const installed = await templateManager.listInstalledTemplates();
    res.json(installed);
  } catch (error) {
    console.error('Error fetching installed templates:', error);
    res.status(500).json({ error: 'Failed to fetch installed templates' });
  }
});

// POST /api/templates/refresh-index - Force refresh the template index cache
app.post('/api/templates/refresh-index', async (req, res) => {
  try {
    // Clear cache
    indexCache = null;
    
    // Update index
    await templateManager.updateIndex();
    
    // Fetch fresh data
    const templates = await templateManager.getTemplateIndex();
    
    // Update cache
    indexCache = {
      data: templates,
      timestamp: Date.now()
    };

    res.json({ 
      success: true, 
      count: templates.length,
      message: 'Template index refreshed successfully' 
    });
  } catch (error) {
    console.error('Error refreshing template index:', error);
    res.status(500).json({ error: 'Failed to refresh template index' });
  }
});

// Mount demos router
app.use('/api', demosRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'dashboard-api',
    timestamp: new Date().toISOString()
  });
});

// Helper function to get template README (mock implementation)
async function getTemplateReadme(name: string): Promise<string | null> {
  // In production, this would download and cache the template README
  // For now, return mock data for known templates
  const mockReadmes: Record<string, string> = {
    'blog-basic': `# Basic Blog Template

A complete blog system with public posts and private comments.

## Features
- **Posts Table**: Publicly readable blog posts
- **Comments Table**: Owner-only comments with privacy
- **Notification Function**: Edge function for comment notifications

## Usage
\`\`\`bash
kickstack template install blog-basic --apply
\`\`\`

## Security
- Posts: Public read, owner write
- Comments: Owner only
`,
    'ecommerce-basic': `# Basic E-commerce Template

Complete e-commerce system with products, orders, and payments.

## Features  
- **Products Table**: Public product catalog
- **Orders Table**: Private customer orders
- **Payment Webhook**: Stripe integration ready

## Usage
\`\`\`bash
kickstack template install ecommerce-basic --apply
\`\`\`

## Security
- Products: Public read
- Orders: Owner only with full privacy
`
  };

  return mockReadmes[name] || null;
}

// Start server
app.listen(PORT, () => {
  console.log(`✨ Dashboard API running on http://localhost:${PORT}`);
  console.log(`📦 Template endpoints available at /api/templates/*`);
});