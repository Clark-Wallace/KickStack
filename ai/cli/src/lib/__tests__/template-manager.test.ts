import { TemplateManager } from '../template-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { jest } from '@jest/globals';

// Mock fs operations
jest.mock('fs/promises');
jest.mock('tar');
jest.mock('node:fs', () => ({
  createWriteStream: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('TemplateManager', () => {
  let manager: TemplateManager;
  let tmpDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new TemplateManager();
    tmpDir = path.join(os.tmpdir(), 'kickstack-test-' + Date.now());
  });

  describe('Template Index', () => {
    it('should fetch and cache template index', async () => {
      const mockTemplates = [
        {
          name: 'test-template',
          display_name: 'Test Template',
          description: 'A test template',
          category: 'test',
          tags: ['test'],
          url: 'https://example.com/test.tar.gz',
          verified: true
        }
      ];

      // Mock successful fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTemplates)
      });

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const templates = await manager.getTemplateIndex();

      expect(templates).toEqual(mockTemplates);
      expect(fetch).toHaveBeenCalledWith('https://templates.kickstack.dev/index.json');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const templates = await manager.getTemplateIndex();

      expect(templates).toEqual([]);
    });
  });

  describe('Template Search', () => {
    beforeEach(() => {
      // Mock getTemplateIndex to return test data
      jest.spyOn(manager, 'getTemplateIndex').mockResolvedValue([
        {
          name: 'blog-basic',
          display_name: 'Basic Blog',
          description: 'A basic blog template',
          category: 'application',
          tags: ['blog', 'social'],
          url: 'https://example.com/blog.tar.gz',
          verified: true
        },
        {
          name: 'ecommerce-basic',
          display_name: 'E-commerce Basic',
          description: 'Basic e-commerce template',
          category: 'application',
          tags: ['shop', 'ecommerce'],
          url: 'https://example.com/shop.tar.gz',
          verified: false
        }
      ]);
    });

    it('should search templates by query', async () => {
      const results = await manager.searchTemplates('blog');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('blog-basic');
    });

    it('should filter by category', async () => {
      const results = await manager.searchTemplates('', { category: 'application' });

      expect(results).toHaveLength(2);
    });

    it('should filter by verified status', async () => {
      const results = await manager.searchTemplates('', { verifiedOnly: true });

      expect(results).toHaveLength(1);
      expect(results[0].verified).toBe(true);
    });

    it('should search by tags', async () => {
      const results = await manager.searchTemplates('shop');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ecommerce-basic');
    });
  });

  describe('Template Info', () => {
    beforeEach(() => {
      jest.spyOn(manager, 'getTemplateIndex').mockResolvedValue([
        {
          name: 'test-template',
          display_name: 'Test Template',
          description: 'A test template',
          category: 'test',
          tags: ['test'],
          url: 'https://example.com/test.tar.gz',
          verified: true
        }
      ]);
    });

    it('should return template info when found', async () => {
      const info = await manager.getTemplateInfo('test-template');

      expect(info.name).toBe('test-template');
      expect(info.display_name).toBe('Test Template');
    });

    it('should throw error when template not found', async () => {
      await expect(manager.getTemplateInfo('nonexistent'))
        .rejects.toThrow("Template 'nonexistent' not found");
    });
  });

  describe('Manifest Validation', () => {
    it('should validate correct manifest', () => {
      const manifest = {
        version: 1,
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test',
        tags: ['test']
      };

      expect(() => manager.validateManifest(manifest)).not.toThrow();
    });

    it('should reject manifest with missing required fields', () => {
      const manifest = {
        version: 1,
        name: 'test-template'
        // Missing required fields
      };

      expect(() => manager.validateManifest(manifest as any))
        .toThrow('Manifest is missing required field');
    });

    it('should reject invalid version', () => {
      const manifest = {
        version: 2,
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test'
      };

      expect(() => manager.validateManifest(manifest as any))
        .toThrow('Unsupported manifest version: 2');
    });

    it('should reject invalid template name', () => {
      const manifest = {
        version: 1,
        name: 'Test Template!',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test'
      };

      expect(() => manager.validateManifest(manifest as any))
        .toThrow('Template name must contain only lowercase letters, numbers, and hyphens');
    });
  });

  describe('Template Installation', () => {
    beforeEach(() => {
      jest.spyOn(manager, 'getTemplateInfo').mockResolvedValue({
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test',
        tags: ['test'],
        url: 'https://example.com/test.tar.gz',
        verified: true
      });

      jest.spyOn(manager, 'downloadTemplate').mockResolvedValue('/tmp/test.tar.gz');
      jest.spyOn(manager, 'extractTemplate').mockResolvedValue({
        version: 1,
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test'
      });
      jest.spyOn(manager, 'recordInstallation').mockResolvedValue(undefined);
    });

    it('should install template successfully', async () => {
      mockFs.readdir.mockResolvedValue(['001_test.sql'] as any);
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rm.mockResolvedValue(undefined);

      const result = await manager.installTemplate('test-template');

      expect(result).toBeDefined();
      expect(jest.spyOn(manager, 'downloadTemplate')).toHaveBeenCalled();
      expect(jest.spyOn(manager, 'extractTemplate')).toHaveBeenCalled();
    });

    it('should warn about unverified templates', async () => {
      jest.spyOn(manager, 'getTemplateInfo').mockResolvedValue({
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test',
        tags: ['test'],
        url: 'https://example.com/test.tar.gz',
        verified: false // Unverified
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockFs.readdir.mockResolvedValue([]);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rm.mockResolvedValue(undefined);

      await manager.installTemplate('test-template');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not verified')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Version Comparison', () => {
    it('should handle version compatibility checks', async () => {
      jest.spyOn(manager, 'getTemplateInfo').mockResolvedValue({
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test',
        tags: ['test'],
        url: 'https://example.com/test.tar.gz',
        verified: true
      });

      jest.spyOn(manager, 'downloadTemplate').mockResolvedValue('/tmp/test.tar.gz');
      jest.spyOn(manager, 'extractTemplate').mockResolvedValue({
        version: 1,
        name: 'test-template',
        display_name: 'Test Template',
        description: 'A test template',
        category: 'test',
        kickstack_min_version: '2.0.0' // Future version
      });

      mockFs.readdir.mockResolvedValue([]);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rm.mockResolvedValue(undefined);

      await expect(manager.installTemplate('test-template'))
        .rejects.toThrow('Template requires KickStack 2.0.0 or higher');
    });
  });
});