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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokenCommand = generateTokenCommand;
const chalk_1 = __importDefault(require("chalk"));
const jwt = __importStar(require("jsonwebtoken"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
async function generateTokenCommand(type, options) {
    console.log(chalk_1.default.blue('🔑 KickStack: Generating JWT token...'));
    // Validate token type
    const validTypes = ['user', 'admin', 'service'];
    if (!validTypes.includes(type)) {
        console.error(chalk_1.default.red(`❌ Invalid token type: ${type}`));
        console.log(chalk_1.default.yellow(`Valid types: ${validTypes.join(', ')}`));
        process.exit(1);
    }
    // Load JWT secret from environment or generate one
    let jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        // Try to load from .env file
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/JWT_SECRET=(.+)/);
            if (match) {
                jwtSecret = match[1];
            }
        }
    }
    if (!jwtSecret) {
        console.log(chalk_1.default.yellow('⚠️  No JWT_SECRET found. Generating a new one...'));
        jwtSecret = crypto.randomBytes(32).toString('hex');
        console.log(chalk_1.default.green(`Generated JWT_SECRET: ${jwtSecret}`));
        console.log(chalk_1.default.gray('Add this to your .env file:'));
        console.log(chalk_1.default.cyan(`JWT_SECRET=${jwtSecret}`));
    }
    // Build token payload based on type
    let payload = {
        iss: 'kickstack',
        iat: Math.floor(Date.now() / 1000),
    };
    // Set expiration (default 1 year for service tokens, 24h for others)
    const expiresIn = options.expiresIn || (type === 'service' ? '365d' : '24h');
    const expirationSeconds = parseExpiration(expiresIn);
    payload.exp = payload.iat + expirationSeconds;
    switch (type) {
        case 'user':
            payload.sub = options.userId || crypto.randomUUID();
            payload.role = 'authenticated';
            payload.email = options.email || 'user@example.com';
            if (options.orgId) {
                payload.org_id = options.orgId;
                payload.org = options.orgId; // Support both claims
            }
            break;
        case 'admin':
            payload.sub = options.userId || crypto.randomUUID();
            payload.role = 'admin';
            payload.email = options.email || 'admin@example.com';
            if (options.orgId) {
                payload.org_id = options.orgId;
                payload.org = options.orgId;
            }
            break;
        case 'service':
            payload.sub = 'service-' + crypto.randomUUID();
            payload.role = 'service_role';
            // Service tokens don't have org restrictions by default
            break;
    }
    // Add any custom claims
    if (options.claims) {
        payload = { ...payload, ...options.claims };
    }
    // Generate token
    const token = jwt.sign(payload, jwtSecret, { algorithm: 'HS256' });
    // Display results
    console.log(chalk_1.default.green('\n✨ Token generated successfully!'));
    console.log(chalk_1.default.white('\n📋 Token Details:'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.cyan('Type:'), type);
    console.log(chalk_1.default.cyan('Role:'), payload.role);
    if (payload.sub)
        console.log(chalk_1.default.cyan('Subject:'), payload.sub);
    if (payload.email)
        console.log(chalk_1.default.cyan('Email:'), payload.email);
    if (payload.org_id)
        console.log(chalk_1.default.cyan('Organization:'), payload.org_id);
    console.log(chalk_1.default.cyan('Expires:'), new Date(payload.exp * 1000).toISOString());
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.white('\n🔐 JWT Token:'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.green(token));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    // Usage examples
    console.log(chalk_1.default.white('\n📖 Usage Examples:'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.green('# Test with curl:'));
    console.log(chalk_1.default.gray(`curl http://localhost:3000/api/test \\
  -H "Authorization: Bearer ${token.substring(0, 20)}..."`));
    console.log(chalk_1.default.green('\n# Set as environment variable:'));
    console.log(chalk_1.default.gray(`export AUTH_TOKEN="${token.substring(0, 20)}..."`));
    if (type === 'service') {
        console.log(chalk_1.default.green('\n# Use for server-side operations:'));
        console.log(chalk_1.default.gray(`const client = createClient(url, key, {
  global: { headers: { Authorization: 'Bearer ${token.substring(0, 20)}...' } }
});`));
    }
    console.log(chalk_1.default.gray('─'.repeat(50)));
    // Warnings
    if (type === 'service') {
        console.log(chalk_1.default.yellow('\n⚠️  Security Warning:'));
        console.log(chalk_1.default.gray('• Service tokens have full database access'));
        console.log(chalk_1.default.gray('• Never expose service tokens in client-side code'));
        console.log(chalk_1.default.gray('• Store securely and rotate regularly'));
    }
    else if (type === 'admin') {
        console.log(chalk_1.default.yellow('\n⚠️  Security Note:'));
        console.log(chalk_1.default.gray('• Admin tokens bypass RLS policies'));
        console.log(chalk_1.default.gray('• Use with caution in production'));
    }
}
function parseExpiration(exp) {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) {
        throw new Error(`Invalid expiration format: ${exp}. Use format like '24h', '7d', '60m', '3600s'`);
    }
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: throw new Error(`Unknown time unit: ${unit}`);
    }
}
//# sourceMappingURL=generate-token.js.map