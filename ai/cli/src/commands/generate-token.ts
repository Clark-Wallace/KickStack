import chalk from 'chalk';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface TokenOptions {
  role?: string;
  userId?: string;
  orgId?: string;
  email?: string;
  expiresIn?: string;
  claims?: Record<string, any>;
}

export async function generateTokenCommand(type: string, options: TokenOptions): Promise<void> {
  console.log(chalk.blue('🔑 KickStack: Generating JWT token...'));
  
  // Validate token type
  const validTypes = ['user', 'admin', 'service'];
  if (!validTypes.includes(type)) {
    console.error(chalk.red(`❌ Invalid token type: ${type}`));
    console.log(chalk.yellow(`Valid types: ${validTypes.join(', ')}`));
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
    console.log(chalk.yellow('⚠️  No JWT_SECRET found. Generating a new one...'));
    jwtSecret = crypto.randomBytes(32).toString('hex');
    console.log(chalk.green(`Generated JWT_SECRET: ${jwtSecret}`));
    console.log(chalk.gray('Add this to your .env file:'));
    console.log(chalk.cyan(`JWT_SECRET=${jwtSecret}`));
  }
  
  // Build token payload based on type
  let payload: any = {
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
  console.log(chalk.green('\n✨ Token generated successfully!'));
  console.log(chalk.white('\n📋 Token Details:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.cyan('Type:'), type);
  console.log(chalk.cyan('Role:'), payload.role);
  if (payload.sub) console.log(chalk.cyan('Subject:'), payload.sub);
  if (payload.email) console.log(chalk.cyan('Email:'), payload.email);
  if (payload.org_id) console.log(chalk.cyan('Organization:'), payload.org_id);
  console.log(chalk.cyan('Expires:'), new Date(payload.exp * 1000).toISOString());
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(chalk.white('\n🔐 JWT Token:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.green(token));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Usage examples
  console.log(chalk.white('\n📖 Usage Examples:'));
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(chalk.green('# Test with curl:'));
  console.log(chalk.gray(`curl http://localhost:3000/api/test \\
  -H "Authorization: Bearer ${token.substring(0, 20)}..."`));
  
  console.log(chalk.green('\n# Set as environment variable:'));
  console.log(chalk.gray(`export AUTH_TOKEN="${token.substring(0, 20)}..."`));
  
  if (type === 'service') {
    console.log(chalk.green('\n# Use for server-side operations:'));
    console.log(chalk.gray(`const client = createClient(url, key, {
  global: { headers: { Authorization: 'Bearer ${token.substring(0, 20)}...' } }
});`));
  }
  
  console.log(chalk.gray('─'.repeat(50)));
  
  // Warnings
  if (type === 'service') {
    console.log(chalk.yellow('\n⚠️  Security Warning:'));
    console.log(chalk.gray('• Service tokens have full database access'));
    console.log(chalk.gray('• Never expose service tokens in client-side code'));
    console.log(chalk.gray('• Store securely and rotate regularly'));
  } else if (type === 'admin') {
    console.log(chalk.yellow('\n⚠️  Security Note:'));
    console.log(chalk.gray('• Admin tokens bypass RLS policies'));
    console.log(chalk.gray('• Use with caution in production'));
  }
}

function parseExpiration(exp: string): number {
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