"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelAdapterFactory = void 0;
const ollama_adapter_1 = require("./ollama-adapter");
const openai_adapter_1 = require("./openai-adapter");
const chalk_1 = __importDefault(require("chalk"));
class ModelAdapterFactory {
    static async create() {
        // Try Ollama first
        const ollamaAdapter = new ollama_adapter_1.OllamaAdapter();
        if (await ollamaAdapter.isAvailable()) {
            console.log(chalk_1.default.green('✓ Using Ollama for AI generation'));
            return ollamaAdapter;
        }
        // Fallback to OpenAI if API key is available
        const openaiAdapter = new openai_adapter_1.OpenAIAdapter();
        if (await openaiAdapter.isAvailable()) {
            console.log(chalk_1.default.green('✓ Using OpenAI for AI generation'));
            return openaiAdapter;
        }
        throw new Error('No AI model available. Please either:\n' +
            '1. Install and run Ollama (https://ollama.ai)\n' +
            '2. Set OPENAI_API_KEY environment variable');
    }
}
exports.ModelAdapterFactory = ModelAdapterFactory;
//# sourceMappingURL=index.js.map