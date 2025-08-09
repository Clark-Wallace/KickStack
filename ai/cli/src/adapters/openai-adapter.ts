import { ModelAdapter, NLTableSpec, TableSQL } from '../types';
import OpenAI from 'openai';

export class OpenAIAdapter implements ModelAdapter {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.openai !== null;
  }

  async nlToCreateTable(spec: NLTableSpec): Promise<TableSQL> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are a PostgreSQL expert. Convert natural language descriptions into CREATE TABLE statements for PostgreSQL.

Rules:
1. Use snake_case for table and column names
2. Table names should be plural
3. Always include: id UUID PRIMARY KEY DEFAULT gen_random_uuid()
4. Always include: created_at TIMESTAMPTZ DEFAULT NOW()
5. Always include: updated_at TIMESTAMPTZ DEFAULT NOW()
6. Use appropriate PostgreSQL types: TEXT, INTEGER, NUMERIC, TIMESTAMPTZ, BOOLEAN, JSONB
7. Add NOT NULL constraints where appropriate
8. Return ONLY the SQL statement, no explanations or markdown`;

    const userPrompt = `Convert this to a CREATE TABLE statement: "${spec.raw}"`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const sql = this.extractSQL(response);
      const tableName = this.extractTableName(sql);

      return { tableName, sql };
    } catch (error) {
      throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private extractSQL(response: string): string {
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