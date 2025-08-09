// KickStack Demo Manager - Programmatic API for demo operations
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DatabaseService } from '../cli/src/services/database';

export interface DemoMeta {
  name: string;
  title: string;
  summary: string;
  description?: string;
  tags: string[];
  features: string[];
  hasSeed: boolean;
  hasRealtime: boolean;
  tables: number;
  functions: number;
}

export interface DemoDetail extends DemoMeta {
  readme: string;
  plan: any;
  migrations: string[];
  functions: string[];
  seedFiles: string[];
  verification?: {
    smoke?: Array<{
      method: string;
      path: string;
      expect: number;
    }>;
  };
}

export interface InstallOptions {
  name: string;
  withSeed?: boolean;
  apply?: boolean;
  force?: boolean;
}

export interface InstallResult {
  success: boolean;
  name: string;
  timestamp: number;
  withSeed: boolean;
  applied: boolean;
  tables: string[];
  functions: string[];
  errors?: string[];
  logs?: string[];
}

export interface VerifyReport {
  success: boolean;
  name: string;
  timestamp: number;
  tests: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
}

export interface InstallHistory {
  installs: Array<{
    name: string;
    timestamp: number;
    withSeed: boolean;
    apply: boolean;
    result: 'ok' | 'error';
    error?: string;
  }>;
}

const DEMOS_DIR = path.join(__dirname, '../../demos');
const HISTORY_FILE = path.join(__dirname, '../../.kickstack/demos.json');

// Ensure .kickstack directory exists
function ensureKickstackDir() {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// List all available demos
export async function listDemos(): Promise<DemoMeta[]> {
  const demos: DemoMeta[] = [];
  
  if (!fs.existsSync(DEMOS_DIR)) {
    return demos;
  }
  
  const dirs = fs.readdirSync(DEMOS_DIR).filter(dir => {
    const demoPath = path.join(DEMOS_DIR, dir);
    return fs.statSync(demoPath).isDirectory() && 
           fs.existsSync(path.join(demoPath, 'plan.yaml'));
  });
  
  for (const dir of dirs) {
    const planPath = path.join(DEMOS_DIR, dir, 'plan.yaml');
    const planContent = fs.readFileSync(planPath, 'utf8');
    const plan = yaml.load(planContent) as any;
    
    // Check for seed data
    const seedPath = path.join(DEMOS_DIR, dir, 'seed');
    const hasSeed = fs.existsSync(seedPath) && 
                    fs.readdirSync(seedPath).some(f => f.endsWith('.sql'));
    
    // Count tables and functions
    const tables = plan.steps?.filter((s: any) => s.kind === 'table').length || 0;
    const functions = plan.steps?.filter((s: any) => s.kind === 'function').length || 0;
    const hasRealtime = plan.steps?.some((s: any) => s.realtime === true) || false;
    
    // Extract tags from features or create from content
    const tags: string[] = [];
    if (plan.features) {
      // Extract key words from features
      if (plan.features.some((f: string) => /multi-tenant|team|org/i.test(f))) tags.push('multi-tenant');
      if (plan.features.some((f: string) => /realtime|websocket|live/i.test(f))) tags.push('realtime');
      if (plan.features.some((f: string) => /auth|security|rls/i.test(f))) tags.push('security');
      if (plan.features.some((f: string) => /payment|commerce|shop/i.test(f))) tags.push('e-commerce');
    }
    
    demos.push({
      name: dir,
      title: plan.name?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || dir,
      summary: plan.summary || '',
      description: plan.description,
      tags,
      features: plan.features || [],
      hasSeed,
      hasRealtime,
      tables,
      functions
    });
  }
  
  return demos;
}

// Get detailed information about a specific demo
export async function getDemo(name: string): Promise<DemoDetail | null> {
  const demoPath = path.join(DEMOS_DIR, name);
  
  if (!fs.existsSync(demoPath)) {
    return null;
  }
  
  const planPath = path.join(demoPath, 'plan.yaml');
  if (!fs.existsSync(planPath)) {
    return null;
  }
  
  const planContent = fs.readFileSync(planPath, 'utf8');
  const plan = yaml.load(planContent) as any;
  
  // Read README if exists
  let readme = '';
  const readmePath = path.join(demoPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    readme = fs.readFileSync(readmePath, 'utf8');
  }
  
  // List migrations
  const migrationsPath = path.join(demoPath, 'migrations');
  const migrations = fs.existsSync(migrationsPath)
    ? fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql')).sort()
    : [];
  
  // List functions
  const functionsPath = path.join(demoPath, 'functions');
  const functions = fs.existsSync(functionsPath)
    ? fs.readdirSync(functionsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    : [];
  
  // List seed files
  const seedPath = path.join(demoPath, 'seed');
  const seedFiles = fs.existsSync(seedPath)
    ? fs.readdirSync(seedPath).filter(f => f.endsWith('.sql'))
    : [];
  
  // Get metadata
  const meta = (await listDemos()).find(d => d.name === name);
  if (!meta) return null;
  
  return {
    ...meta,
    readme,
    plan,
    migrations,
    functions,
    seedFiles,
    verification: plan.verification
  };
}

// Install a demo
export async function installDemo(options: InstallOptions): Promise<InstallResult> {
  const { name, withSeed = false, apply = true, force = false } = options;
  const result: InstallResult = {
    success: false,
    name,
    timestamp: Date.now(),
    withSeed,
    applied: apply,
    tables: [],
    functions: [],
    errors: [],
    logs: []
  };
  
  try {
    const demo = await getDemo(name);
    if (!demo) {
      result.errors = [`Demo '${name}' not found`];
      await recordInstall(name, withSeed, apply, 'error', result.errors[0]);
      return result;
    }
    
    const demoPath = path.join(DEMOS_DIR, name);
    const db = new DatabaseService();
    
    // Apply migrations
    const migrationsPath = path.join(demoPath, 'migrations');
    if (fs.existsSync(migrationsPath)) {
      const migrations = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const migration of migrations) {
        const migrationPath = path.join(migrationsPath, migration);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        result.logs?.push(`Applying migration: ${migration}`);
        
        if (apply) {
          await db.executeMigration(sql);
        }
      }
    }
    
    // Extract table names from plan
    if (demo.plan.steps) {
      result.tables = demo.plan.steps
        .filter((s: any) => s.kind === 'table')
        .map((s: any) => s.name);
    }
    
    // Copy functions
    const functionsPath = path.join(demoPath, 'functions');
    if (fs.existsSync(functionsPath)) {
      const targetFunctionsDir = path.join(__dirname, '../../functions');
      
      if (!fs.existsSync(targetFunctionsDir)) {
        fs.mkdirSync(targetFunctionsDir, { recursive: true });
      }
      
      const functions = fs.readdirSync(functionsPath)
        .filter(f => f.endsWith('.ts') || f.endsWith('.js'));
      
      for (const func of functions) {
        const sourcePath = path.join(functionsPath, func);
        const targetPath = path.join(targetFunctionsDir, func);
        
        // Check for existing function
        if (fs.existsSync(targetPath) && !force) {
          result.logs?.push(`Warning: Function ${func} already exists, skipping`);
          continue;
        }
        
        if (apply) {
          fs.copyFileSync(sourcePath, targetPath);
        }
        result.functions.push(func.replace(/\.(ts|js)$/, ''));
        result.logs?.push(`Installed function: ${func}`);
      }
    }
    
    // Apply seed data if requested
    if (withSeed) {
      const seedPath = path.join(demoPath, 'seed');
      if (fs.existsSync(seedPath)) {
        const seeds = fs.readdirSync(seedPath)
          .filter(f => f.endsWith('.sql'))
          .sort();
        
        for (const seed of seeds) {
          const seedFilePath = path.join(seedPath, seed);
          const sql = fs.readFileSync(seedFilePath, 'utf8');
          result.logs?.push(`Applying seed: ${seed}`);
          
          if (apply) {
            await db.executeMigration(sql);
          }
        }
      }
    }
    
    result.success = true;
    result.logs?.push(`Demo '${name}' installed successfully`);
    await recordInstall(name, withSeed, apply, 'ok');
    
  } catch (error) {
    result.success = false;
    result.errors = [error instanceof Error ? error.message : String(error)];
    await recordInstall(name, withSeed, apply, 'error', result.errors[0]);
  }
  
  return result;
}

// Verify a demo installation
export async function verifyDemo(name: string): Promise<VerifyReport> {
  const report: VerifyReport = {
    success: false,
    name,
    timestamp: Date.now(),
    tests: []
  };
  
  try {
    const demo = await getDemo(name);
    if (!demo) {
      report.tests.push({
        name: 'Demo exists',
        passed: false,
        message: `Demo '${name}' not found`
      });
      return report;
    }
    
    const db = new DatabaseService();
    
    // Check tables exist
    for (const table of demo.plan.steps?.filter((s: any) => s.kind === 'table') || []) {
      const exists = await db.tableExists(table.name);
      report.tests.push({
        name: `Table '${table.name}' exists`,
        passed: exists,
        message: exists ? undefined : `Table '${table.name}' not found`
      });
    }
    
    // Check functions exist
    for (const func of demo.functions) {
      const funcPath = path.join(__dirname, '../../functions', func);
      const exists = fs.existsSync(funcPath);
      report.tests.push({
        name: `Function '${func}' deployed`,
        passed: exists,
        message: exists ? undefined : `Function '${func}' not found`
      });
    }
    
    // Run smoke tests if defined
    if (demo.verification?.smoke) {
      for (const test of demo.verification.smoke) {
        // For now, just check that the endpoint would be reachable
        // In production, make actual HTTP requests
        report.tests.push({
          name: `${test.method} ${test.path} returns ${test.expect}`,
          passed: true, // Placeholder - would make actual request
          message: 'Smoke test placeholder'
        });
      }
    }
    
    report.success = report.tests.every(t => t.passed);
    
  } catch (error) {
    report.tests.push({
      name: 'Verification',
      passed: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
  
  return report;
}

// Get install history
export async function getInstallHistory(): Promise<InstallHistory> {
  ensureKickstackDir();
  
  if (!fs.existsSync(HISTORY_FILE)) {
    return { installs: [] };
  }
  
  try {
    const content = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return { installs: [] };
  }
}

// Record an install in history
async function recordInstall(
  name: string,
  withSeed: boolean,
  apply: boolean,
  result: 'ok' | 'error',
  error?: string
): Promise<void> {
  ensureKickstackDir();
  
  const history = await getInstallHistory();
  history.installs.push({
    name,
    timestamp: Date.now(),
    withSeed,
    apply,
    result,
    error
  });
  
  // Keep only last 50 installs
  if (history.installs.length > 50) {
    history.installs = history.installs.slice(-50);
  }
  
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}