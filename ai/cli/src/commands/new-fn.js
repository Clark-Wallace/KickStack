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
exports.newFnCommand = newFnCommand;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
async function newFnCommand(functionName, options) {
    console.log(chalk_1.default.blue('⚡ KickStack: Creating new function...'));
    console.log(chalk_1.default.gray(`Name: ${functionName}`));
    // Validate function name
    if (!/^[a-z][a-z0-9_]*$/.test(functionName)) {
        console.error(chalk_1.default.red('❌ Function name must start with a letter and contain only lowercase letters, numbers, and underscores'));
        process.exit(1);
    }
    // Check if functions directory exists
    const functionsDir = path.join(process.cwd(), 'api', 'functions');
    if (!fs.existsSync(functionsDir)) {
        console.log(chalk_1.default.yellow('📁 Creating functions directory...'));
        fs.mkdirSync(functionsDir, { recursive: true });
    }
    // Check if function already exists
    const functionPath = path.join(functionsDir, `${functionName}.ts`);
    if (fs.existsSync(functionPath)) {
        console.error(chalk_1.default.red(`❌ Function '${functionName}' already exists!`));
        process.exit(1);
    }
    // Check if types file exists
    const typesPath = path.join(functionsDir, 'types.ts');
    if (!fs.existsSync(typesPath)) {
        console.log(chalk_1.default.yellow('📝 Creating types file...'));
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
    console.log(chalk_1.default.green(`✓ Function created: ${functionPath}`));
    // Handle secret option
    if (options.withSecret) {
        const secretName = `KICKSTACK_FN_${options.withSecret.toUpperCase()}`;
        console.log(chalk_1.default.yellow('\n📝 Add this to your /infra/.env file:'));
        console.log(chalk_1.default.gray(`${secretName}=your-secret-value`));
        console.log(chalk_1.default.gray('\nThen access it in your function with:'));
        console.log(chalk_1.default.cyan(`const secret = ctx.env['${secretName}'];`));
    }
    // Display usage instructions
    console.log(chalk_1.default.white('\n📖 Usage:'));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    console.log(chalk_1.default.green('1. Start the Functions Gateway:'));
    console.log(chalk_1.default.gray('   npm run fngw:dev'));
    console.log(chalk_1.default.green('\n2. Call your function:'));
    console.log(chalk_1.default.gray(`   curl -X POST http://localhost:8787/fn/${functionName} \\`));
    console.log(chalk_1.default.gray(`     -H "Content-Type: application/json" \\`));
    if (!isPublic) {
        console.log(chalk_1.default.gray(`     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\`));
    }
    console.log(chalk_1.default.gray(`     -d '{"message": "Hello, ${functionName}!"}'`));
    console.log(chalk_1.default.gray('─'.repeat(50)));
    if (isPublic) {
        console.log(chalk_1.default.yellow('\n💡 Note: This is a public function (no auth required)'));
    }
    else {
        console.log(chalk_1.default.yellow('\n🔐 Note: This function requires authentication'));
        console.log(chalk_1.default.gray('   Get a JWT token from GoTrue auth service first'));
    }
    console.log(chalk_1.default.green(`\n✅ Function '${functionName}' is ready!`));
}
//# sourceMappingURL=new-fn.js.map