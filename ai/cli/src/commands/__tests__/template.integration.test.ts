import { TemplateManager } from '../../lib/template-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Template Integration Tests', () => {
  let manager: TemplateManager;
  let testDir: string;

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kickstack-template-test-'));
    manager = new TemplateManager();
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Template Packaging', () => {
    let templateDir: string;

    beforeEach(async () => {
      // Create a test template directory
      templateDir = path.join(testDir, 'test-template');
      await fs.mkdir(templateDir, { recursive: true });

      // Create manifest
      const manifest = {
        version: 1,
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template for integration testing',
        category: 'test',
        tags: ['test', 'integration'],
        author: '@test',
        license: 'MIT',
        kickstack_min_version: '1.0.0',
        contents: {
          tables: ['test_table'],
          policies: ['owner'],
          functions: ['test_function']
        }
      };

      await fs.writeFile(
        path.join(templateDir, 'manifest.yaml'),
        `version: ${manifest.version}
name: ${manifest.name}
display_name: "${manifest.display_name}"
description: "${manifest.description}"
category: ${manifest.category}
tags: ${JSON.stringify(manifest.tags)}
author: "${manifest.author}"
license: ${manifest.license}
kickstack_min_version: "${manifest.kickstack_min_version}"
contents:
  tables: ${JSON.stringify(manifest.contents.tables)}
  policies: ${JSON.stringify(manifest.contents.policies)}
  functions: ${JSON.stringify(manifest.contents.functions)}`
      );

      // Create migrations directory with SQL file
      const migrationsDir = path.join(templateDir, 'migrations');
      await fs.mkdir(migrationsDir);
      await fs.writeFile(
        path.join(migrationsDir, '001_create_test_table.sql'),
        `CREATE TABLE test_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);`
      );

      // Create functions directory with TypeScript file
      const functionsDir = path.join(templateDir, 'functions');
      await fs.mkdir(functionsDir);
      await fs.writeFile(
        path.join(functionsDir, 'test_function.ts'),
        `import type { KickContext, KickEvent } from "./types";

export default async function testFunction(event: KickEvent, ctx: KickContext) {
  return { ok: true, message: 'Test function works!' };
}`
      );

      // Create README
      await fs.writeFile(
        path.join(templateDir, 'README.md'),
        `# Test Template

This is a test template for integration testing.`
      );
    });

    it('should validate template structure', async () => {
      await expect(manager.validateTemplate(templateDir)).resolves.not.toThrow();
    });

    it('should package template successfully', async () => {
      const outputPath = path.join(testDir, 'test-template.tar.gz');
      
      const result = await manager.packageTemplate(templateDir, outputPath);
      
      expect(result.filename).toBe(outputPath);
      expect(result.size).toBeGreaterThan(0);
      
      // Verify package file exists
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should fail validation with missing manifest', async () => {
      const invalidDir = path.join(testDir, 'invalid-template');
      await fs.mkdir(invalidDir);

      await expect(manager.validateTemplate(invalidDir))
        .rejects.toThrow('Failed to load template manifest');
    });

    it('should fail validation with invalid manifest', async () => {
      const invalidDir = path.join(testDir, 'invalid-template-2');
      await fs.mkdir(invalidDir);

      // Create invalid manifest (missing required fields)
      await fs.writeFile(
        path.join(invalidDir, 'manifest.yaml'),
        `version: 1
name: test`
      );

      await expect(manager.validateTemplate(invalidDir))
        .rejects.toThrow('Manifest is missing required field');
    });

    it('should fail validation when declared directories are missing', async () => {
      const incompleteDir = path.join(testDir, 'incomplete-template');
      await fs.mkdir(incompleteDir);

      // Create manifest that declares functions but no functions directory
      await fs.writeFile(
        path.join(incompleteDir, 'manifest.yaml'),
        `version: 1
name: incomplete-template
display_name: "Incomplete Template"
description: "Missing declared directories"
category: test
contents:
  functions: ["test_function"]`
      );

      await expect(manager.validateTemplate(incompleteDir))
        .rejects.toThrow('Template declares functions but functions/ directory is missing');
    });
  });

  describe('Template File Operations', () => {
    it('should handle manifest loading correctly', async () => {
      const templateDir = path.join(testDir, 'manifest-test');
      await fs.mkdir(templateDir);

      const manifestContent = `version: 1
name: manifest-test
display_name: "Manifest Test"
description: "Testing manifest loading"
category: test
tags: ["test"]`;

      await fs.writeFile(path.join(templateDir, 'manifest.yaml'), manifestContent);

      const manifest = await manager.loadManifest(templateDir);

      expect(manifest.version).toBe(1);
      expect(manifest.name).toBe('manifest-test');
      expect(manifest.display_name).toBe('Manifest Test');
      expect(manifest.tags).toEqual(['test']);
    });

    it('should handle installed templates tracking', async () => {
      const mockManifest = {
        version: 1,
        name: 'installed-test',
        display_name: 'Installed Test',
        description: 'Testing installation tracking',
        category: 'test'
      };

      await manager.recordInstallation(mockManifest);

      const installed = await manager.listInstalledTemplates();
      const found = installed.find(t => t.name === 'installed-test');

      expect(found).toBeDefined();
      expect(found.name).toBe('installed-test');
      expect(found.installed_at).toBeDefined();
    });
  });

  describe('Template Index Management', () => {
    it('should handle custom index addition', async () => {
      const customIndexUrl = 'https://example.com/custom-index.json';
      
      await manager.addCustomIndex(customIndexUrl);
      
      // Check if the index was added to configuration
      // This would require implementing a method to list custom indexes
      // For now, we just verify the method doesn't throw
      expect(true).toBe(true);
    });

    it('should handle index update without errors', async () => {
      // Mock a successful index update
      await expect(manager.updateIndex()).resolves.not.toThrow();
    });
  });
});