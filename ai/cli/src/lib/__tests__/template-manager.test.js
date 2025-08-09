"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const template_manager_1 = require("../template-manager");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const globals_1 = require("@jest/globals");
// Mock fs operations
globals_1.jest.mock('fs/promises');
globals_1.jest.mock('tar');
globals_1.jest.mock('node:fs', () => ({
    createWriteStream: globals_1.jest.fn()
}));
const mockFs = fs;
describe('TemplateManager', () => {
    let manager;
    let tmpDir;
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
        manager = new template_manager_1.TemplateManager();
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
            global.fetch = globals_1.jest.fn().mockResolvedValue({
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
            global.fetch = globals_1.jest.fn().mockRejectedValue(new Error('Network error'));
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);
            const templates = await manager.getTemplateIndex();
            expect(templates).toEqual([]);
        });
    });
    describe('Template Search', () => {
        beforeEach(() => {
            // Mock getTemplateIndex to return test data
            globals_1.jest.spyOn(manager, 'getTemplateIndex').mockResolvedValue([
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
            globals_1.jest.spyOn(manager, 'getTemplateIndex').mockResolvedValue([
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
            expect(() => manager.validateManifest(manifest))
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
            expect(() => manager.validateManifest(manifest))
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
            expect(() => manager.validateManifest(manifest))
                .toThrow('Template name must contain only lowercase letters, numbers, and hyphens');
        });
    });
    describe('Template Installation', () => {
        beforeEach(() => {
            globals_1.jest.spyOn(manager, 'getTemplateInfo').mockResolvedValue({
                name: 'test-template',
                display_name: 'Test Template',
                description: 'A test template',
                category: 'test',
                tags: ['test'],
                url: 'https://example.com/test.tar.gz',
                verified: true
            });
            globals_1.jest.spyOn(manager, 'downloadTemplate').mockResolvedValue('/tmp/test.tar.gz');
            globals_1.jest.spyOn(manager, 'extractTemplate').mockResolvedValue({
                version: 1,
                name: 'test-template',
                display_name: 'Test Template',
                description: 'A test template',
                category: 'test'
            });
            globals_1.jest.spyOn(manager, 'recordInstallation').mockResolvedValue(undefined);
        });
        it('should install template successfully', async () => {
            mockFs.readdir.mockResolvedValue(['001_test.sql']);
            mockFs.copyFile.mockResolvedValue(undefined);
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.rm.mockResolvedValue(undefined);
            const result = await manager.installTemplate('test-template');
            expect(result).toBeDefined();
            expect(globals_1.jest.spyOn(manager, 'downloadTemplate')).toHaveBeenCalled();
            expect(globals_1.jest.spyOn(manager, 'extractTemplate')).toHaveBeenCalled();
        });
        it('should warn about unverified templates', async () => {
            globals_1.jest.spyOn(manager, 'getTemplateInfo').mockResolvedValue({
                name: 'test-template',
                display_name: 'Test Template',
                description: 'A test template',
                category: 'test',
                tags: ['test'],
                url: 'https://example.com/test.tar.gz',
                verified: false // Unverified
            });
            const consoleSpy = globals_1.jest.spyOn(console, 'log').mockImplementation();
            mockFs.readdir.mockResolvedValue([]);
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.rm.mockResolvedValue(undefined);
            await manager.installTemplate('test-template');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not verified'));
            consoleSpy.mockRestore();
        });
    });
    describe('Version Comparison', () => {
        it('should handle version compatibility checks', async () => {
            globals_1.jest.spyOn(manager, 'getTemplateInfo').mockResolvedValue({
                name: 'test-template',
                display_name: 'Test Template',
                description: 'A test template',
                category: 'test',
                tags: ['test'],
                url: 'https://example.com/test.tar.gz',
                verified: true
            });
            globals_1.jest.spyOn(manager, 'downloadTemplate').mockResolvedValue('/tmp/test.tar.gz');
            globals_1.jest.spyOn(manager, 'extractTemplate').mockResolvedValue({
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
//# sourceMappingURL=template-manager.test.js.map