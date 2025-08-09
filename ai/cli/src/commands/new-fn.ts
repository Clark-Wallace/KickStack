import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

interface NewFnOptions {
  withSecret?: string;
}

const functionTemplate = `import type { KickContext, KickEvent } from "./types";

export default async function handler(event: KickEvent, ctx: KickContext) {
  // Log the invocation
  ctx.log("Function called", { 
    user: ctx.user?.sub,
    method: event.method,
    query: event.query 
  });
  
  // Check authentication if needed
  if (!ctx.user) {
    return {
      ok: false,
      error: "Authentication required"
    };
  }
  
  // Your function logic here
  const data = event.body as any;
  
  return {
    ok: true,
    message: "Function executed successfully",
    user: ctx.user,
    received: data,
    timestamp: new Date().toISOString()
  };
}`;

const publicFunctionTemplate = `import type { KickContext, KickEvent } from "./types";

export default async function handler(event: KickEvent, ctx: KickContext) {
  // Log the invocation
  ctx.log("Function called", { 
    user: ctx.user?.sub || "anonymous",
    method: event.method,
    query: event.query 
  });
  
  // Your function logic here (no auth required)
  const data = event.body as any;
  
  return {
    ok: true,
    message: "Hello from {{NAME}} function!",
    user: ctx.user,
    received: data,
    timestamp: new Date().toISOString()
  };
}`;

export async function newFnCommand(
  functionName: string,
  options: NewFnOptions
): Promise<void> {
  console.log(chalk.blue('⚡ KickStack: Creating new function...'));
  console.log(chalk.gray(`Name: ${functionName}`));
  
  // Validate function name
  if (!/^[a-z][a-z0-9_]*$/.test(functionName)) {
    console.error(chalk.red('❌ Function name must start with a letter and contain only lowercase letters, numbers, and underscores'));
    process.exit(1);
  }
  
  // Check if functions directory exists
  const functionsDir = path.join(process.cwd(), 'api', 'functions');
  if (!fs.existsSync(functionsDir)) {
    console.log(chalk.yellow('📁 Creating functions directory...'));
    fs.mkdirSync(functionsDir, { recursive: true });
  }
  
  // Check if function already exists
  const functionPath = path.join(functionsDir, `${functionName}.ts`);
  if (fs.existsSync(functionPath)) {
    console.error(chalk.red(`❌ Function '${functionName}' already exists!`));
    process.exit(1);
  }
  
  // Check if types file exists
  const typesPath = path.join(functionsDir, 'types.ts');
  if (!fs.existsSync(typesPath)) {
    console.log(chalk.yellow('📝 Creating types file...'));
    const typesContent = `export type KickUser = { sub: string; role: string } | null;

export type KickContext = {
  user: KickUser;
  env: Record<string, string | undefined>;
  log: (...args: any[]) => void;
};

export type KickEvent = {
  name: string;
  method: "POST";
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
};`;
    fs.writeFileSync(typesPath, typesContent);
  }
  
  // Determine which template to use
  const isPublic = functionName.startsWith('public_') || functionName === 'hello';
  const template = isPublic ? publicFunctionTemplate : functionTemplate;
  
  // Replace placeholders
  const functionContent = template.replace(/\{\{NAME\}\}/g, functionName);
  
  // Write the function file
  fs.writeFileSync(functionPath, functionContent);
  console.log(chalk.green(`✓ Function created: ${functionPath}`));
  
  // Handle secret option
  if (options.withSecret) {
    const secretName = `KICKSTACK_FN_${options.withSecret.toUpperCase()}`;
    console.log(chalk.yellow('\n📝 Add this to your /infra/.env file:'));
    console.log(chalk.gray(`${secretName}=your-secret-value`));
    console.log(chalk.gray('\nThen access it in your function with:'));
    console.log(chalk.cyan(`const secret = ctx.env['${secretName}'];`));
  }
  
  // Display usage instructions
  console.log(chalk.white('\n📖 Usage:'));
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(chalk.green('1. Start the Functions Gateway:'));
  console.log(chalk.gray('   npm run fngw:dev'));
  
  console.log(chalk.green('\n2. Call your function:'));
  console.log(chalk.gray(`   curl -X POST http://localhost:8787/fn/${functionName} \\`));
  console.log(chalk.gray(`     -H "Content-Type: application/json" \\`));
  if (!isPublic) {
    console.log(chalk.gray(`     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\`));
  }
  console.log(chalk.gray(`     -d '{"message": "Hello, ${functionName}!"}'`));
  
  console.log(chalk.gray('─'.repeat(50)));
  
  if (isPublic) {
    console.log(chalk.yellow('\n💡 Note: This is a public function (no auth required)'));
  } else {
    console.log(chalk.yellow('\n🔐 Note: This function requires authentication'));
    console.log(chalk.gray('   Get a JWT token from GoTrue auth service first'));
  }
  
  console.log(chalk.green(`\n✅ Function '${functionName}' is ready!`));
}