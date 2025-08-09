// Dashboard API - Demo routes
import { Router, Request, Response } from 'express';
import { 
  listDemos, 
  getDemo, 
  installDemo, 
  verifyDemo, 
  getInstallHistory 
} from '../../../../ai/demo-manager';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Simple in-memory cache for demo metadata (5 minutes)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// GET /dashboard/demos - List all available demos
router.get('/demos', async (req: Request, res: Response) => {
  try {
    // Check cache first
    let demos = getCached<any[]>('demos-list');
    
    if (!demos) {
      demos = await listDemos();
      setCached('demos-list', demos);
    }
    
    // Apply search filter if provided
    const search = req.query.search as string;
    if (search) {
      const searchLower = search.toLowerCase();
      demos = demos.filter(demo => 
        demo.name.toLowerCase().includes(searchLower) ||
        demo.title.toLowerCase().includes(searchLower) ||
        demo.summary.toLowerCase().includes(searchLower) ||
        demo.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply tag filter if provided
    const tag = req.query.tag as string;
    if (tag) {
      demos = demos.filter(demo => demo.tags.includes(tag));
    }
    
    res.json({ 
      success: true,
      demos,
      total: demos.length 
    });
  } catch (error) {
    console.error('Error listing demos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list demos' 
    });
  }
});

// GET /dashboard/demos/:name - Get demo details
router.get('/demos/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    // Check cache first
    const cacheKey = `demo-detail-${name}`;
    let demo = getCached<any>(cacheKey);
    
    if (!demo) {
      demo = await getDemo(name);
      if (demo) {
        setCached(cacheKey, demo);
      }
    }
    
    if (!demo) {
      return res.status(404).json({ 
        success: false,
        error: `Demo '${name}' not found` 
      });
    }
    
    res.json({ 
      success: true,
      demo 
    });
  } catch (error) {
    console.error('Error getting demo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get demo details' 
    });
  }
});

// POST /dashboard/demos/install - Install a demo
router.post('/demos/install', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, apply = true, withSeed = false } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: 'Demo name is required' 
      });
    }
    
    // Clear cache for this demo
    cache.delete(`demo-detail-${name}`);
    cache.delete('demos-list');
    
    const result = await installDemo({
      name,
      withSeed,
      apply
    });
    
    res.json({ 
      success: result.success,
      result 
    });
  } catch (error) {
    console.error('Error installing demo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to install demo',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /dashboard/demos/verify - Verify demo installation
router.post('/demos/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        error: 'Demo name is required' 
      });
    }
    
    const report = await verifyDemo(name);
    
    res.json({ 
      success: report.success,
      report 
    });
  } catch (error) {
    console.error('Error verifying demo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify demo' 
    });
  }
});

// GET /dashboard/demos/history - Get installation history
router.get('/demos/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const history = await getInstallHistory();
    
    // Sort by timestamp descending (most recent first)
    history.installs.sort((a, b) => b.timestamp - a.timestamp);
    
    // Optionally filter by demo name
    const name = req.query.name as string;
    if (name) {
      history.installs = history.installs.filter(i => i.name === name);
    }
    
    res.json({ 
      success: true,
      history 
    });
  } catch (error) {
    console.error('Error getting install history:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get install history' 
    });
  }
});

// POST /dashboard/demos/clear-cache - Clear demo cache (admin only)
router.post('/demos/clear-cache', requireAuth, async (req: Request, res: Response) => {
  try {
    cache.clear();
    res.json({ 
      success: true,
      message: 'Cache cleared successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear cache' 
    });
  }
});

export default router;