import { ModelAdapter, NLTableSpec, TableSQL } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class OllamaAdapter implements ModelAdapter {
  private model = 'llama3.2:3b'; // Using a smaller, more common model as fallback
  
  async generateSQL(prompt: string): Promise<string> {
    // Get available models and use the first one
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json() as { models?: Array<{ name: string }> };
      if (data.models && data.models.length > 0) {
        this.model = data.models[0].name;
      }
    } catch {
      // Use default model
    }

    const ollResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
        temperature: 0.3,
      }),
    });

    if (!ollResponse.ok) {
      throw new Error(`Ollama API error: ${ollResponse.statusText}`);
    }

    const result = await ollResponse.json() as { response: string };
    return result.response;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama is running
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) return false;
      
      const data = await response.json() as { models?: Array<{ name: string }> };
      // Check if any model is available (we'll use whatever is installed)
      return !!(data.models && data.models.length > 0);
    } catch {
      return false;
    }
  }

  async nlToCreateTable(spec: NLTableSpec): Promise<TableSQL> {
    // Get available models and use the first one
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json() as { models?: Array<{ name: string }> };
      if (data.models && data.models.length > 0) {
        this.model = data.models[0].name;
      }
    } catch {
      // Use default model
    }

    const prompt = `You are a PostgreSQL expert. Convert this natural language description into a CREATE TABLE statement for PostgreSQL.

Description: "${spec.raw}"

Requirements:
1. Use snake_case for table and column names
2. Table name should be plural
3. Include an id column as UUID PRIMARY KEY DEFAULT gen_random_uuid()
4. Include created_at TIMESTAMPTZ DEFAULT NOW()
5. Include updated_at TIMESTAMPTZ DEFAULT NOW()
6. Infer appropriate PostgreSQL data types (TEXT, INTEGER, NUMERIC, TIMESTAMPTZ, BOOLEAN, JSONB)
7. For dates/times use TIMESTAMPTZ type
8. Add NOT NULL constraints where appropriate
9. Return ONLY the SQL statement, no explanations

Example input: "users with name, email, age"
Example output:
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  age INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

Now generate the CREATE TABLE statement:`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json() as { response: string };
      const sql = this.extractSQL(data.response);
      const tableName = this.extractTableName(sql);

      return { tableName, sql };
    } catch (error) {
      throw new Error(`Ollama generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private extractSQL(response: string): string {
    // Extract SQL from response, handling various formats
    let sql = response.trim();
    
    // Remove markdown code blocks if present
    sql = sql.replace(/```sql\n?/gi, '').replace(/```\n?/g, '');
    
    // Find CREATE TABLE statement
    const match = sql.match(/CREATE\s+TABLE[\s\S]+?;/i);
    if (match) {
      return match[0].trim();
    }
    
    // If no semicolon, try to add one
    if (!sql.endsWith(';')) {
      sql += ';';
    }
    
    return sql;
  }

  private extractTableName(sql: string): string {
    const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
    if (!match) {
      throw new Error('Could not extract table name from SQL');
    }
    return match[1].toLowerCase();
  }
}