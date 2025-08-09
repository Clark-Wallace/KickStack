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
exports.MigrationService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MigrationService {
    migrationsDir;
    constructor() {
        this.migrationsDir = path.join(__dirname, '../../../../infra/migrations');
        // Create migrations directory if it doesn't exist
        if (!fs.existsSync(this.migrationsDir)) {
            fs.mkdirSync(this.migrationsDir, { recursive: true });
        }
    }
    async writeMigration(tableSQL) {
        const timestamp = this.getTimestamp();
        const filename = `${timestamp}_add_table_${tableSQL.tableName}.sql`;
        const filepath = path.join(this.migrationsDir, filename);
        // Add header comment to migration
        const migrationContent = `-- Migration: Add ${tableSQL.tableName} table
-- Generated: ${new Date().toISOString()}
-- Description: Auto-generated from natural language specification

${tableSQL.sql}

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_${tableSQL.tableName}_created_at ON ${tableSQL.tableName}(created_at);
CREATE INDEX IF NOT EXISTS idx_${tableSQL.tableName}_updated_at ON ${tableSQL.tableName}(updated_at);
`;
        fs.writeFileSync(filepath, migrationContent, 'utf8');
        return filepath;
    }
    getTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}`;
    }
}
exports.MigrationService = MigrationService;
//# sourceMappingURL=migration.js.map