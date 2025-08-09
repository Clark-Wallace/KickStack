import { ModelAdapter, NLTableSpec, TableSQL } from '../types';
import { OllamaAdapter } from './ollama-adapter';
import { OpenAIAdapter } from './openai-adapter';
import chalk from 'chalk';

export class ModelAdapterFactory {
  static async create(): Promise<ModelAdapter> {
    // Try Ollama first
    const ollamaAdapter = new OllamaAdapter();
    if (await ollamaAdapter.isAvailable()) {
      console.log(chalk.green('✓ Using Ollama for AI generation'));
      return ollamaAdapter;
    }

    // Fallback to OpenAI if API key is available
    const openaiAdapter = new OpenAIAdapter();
    if (await openaiAdapter.isAvailable()) {
      console.log(chalk.green('✓ Using OpenAI for AI generation'));
      return openaiAdapter;
    }

    throw new Error(
      'No AI model available. Please either:\n' +
      '1. Install and run Ollama (https://ollama.ai)\n' +
      '2. Set OPENAI_API_KEY environment variable'
    );
  }
}