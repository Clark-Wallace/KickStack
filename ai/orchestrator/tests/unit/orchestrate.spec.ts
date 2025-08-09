import { Orchestrator } from '../../src/orchestrate';
import { Plan } from '../../src/types';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeAll(() => {
    orchestrator = new Orchestrator();
  });

  describe('renderPlan', () => {
    it('should generate CREATE TABLE SQL for a simple table', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Test table',
        steps: [
          {
            kind: 'table',
            name: 'posts',
            columns: [
              { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
              { name: 'title', type: 'text', nullable: false },
              { name: 'created_at', type: 'timestamptz', default: 'now()' }
            ]
          }
        ]
      };

      const result = orchestrator.renderPlan(plan);

      expect(result.migrations).toHaveLength(1);
      expect(result.migrations[0].content).toContain('CREATE TABLE IF NOT EXISTS public."posts"');
      expect(result.migrations[0].content).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()');
      expect(result.migrations[0].content).toContain('"title" TEXT NOT NULL');
      expect(result.migrations[0].content).toContain('"created_at" TIMESTAMPTZ DEFAULT now()');
    });

    it('should generate RLS policies for owner preset', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Test table with owner policy',
        steps: [
          {
            kind: 'table',
            name: 'comments',
            columns: [
              { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
              { name: 'user_id', type: 'uuid', nullable: false },
              { name: 'content', type: 'text', nullable: false }
            ],
            policy: {
              preset: 'owner',
              owner_col: 'user_id'
            }
          }
        ]
      };

      const result = orchestrator.renderPlan(plan);

      expect(result.migrations).toHaveLength(2); // CREATE TABLE + RLS
      const policyMigration = result.migrations.find(m => m.name.includes('rls_owner'));
      expect(policyMigration).toBeDefined();
      expect(policyMigration!.content).toContain('CREATE POLICY select_own');
      expect(policyMigration!.content).toContain('"user_id" = auth_uid()');
    });

    it('should generate RLS policies for public_read preset', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Test table with public_read policy',
        steps: [
          {
            kind: 'table',
            name: 'articles',
            columns: [
              { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
              { name: 'author_id', type: 'uuid', nullable: false },
              { name: 'title', type: 'text', nullable: false }
            ],
            policy: {
              preset: 'public_read',
              owner_col: 'author_id'
            }
          }
        ]
      };

      const result = orchestrator.renderPlan(plan);

      expect(result.migrations).toHaveLength(2); // CREATE TABLE + RLS
      const policyMigration = result.migrations.find(m => m.name.includes('rls_public_read'));
      expect(policyMigration).toBeDefined();
      expect(policyMigration!.content).toContain('CREATE POLICY select_public');
      expect(policyMigration!.content).toContain('USING (TRUE)');
    });

    it('should generate edge function code', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Test function',
        steps: [
          {
            kind: 'function',
            name: 'test_function',
            runtime: 'edge',
            path: '/api/functions/test_function.ts'
          }
        ]
      };

      const result = orchestrator.renderPlan(plan);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].path).toBe('/api/functions/test_function.ts');
      expect(result.functions[0].content).toContain('export default async function handler');
      expect(result.functions[0].content).toContain('KickContext, KickEvent');
    });

    it('should generate function with environment variables', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Test function with env vars',
        steps: [
          {
            kind: 'function',
            name: 'webhook_handler',
            runtime: 'edge',
            path: '/api/functions/webhook_handler.ts',
            env: ['KICKSTACK_FN_API_KEY', 'KICKSTACK_FN_SECRET']
          }
        ]
      };

      const result = orchestrator.renderPlan(plan);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].content).toContain("const api_key = ctx.env['KICKSTACK_FN_API_KEY']");
      expect(result.functions[0].content).toContain("const secret = ctx.env['KICKSTACK_FN_SECRET']");
    });

    it('should generate realtime triggers when specified', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Test table with realtime',
        steps: [
          {
            kind: 'table',
            name: 'live_data',
            columns: [
              { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
              { name: 'value', type: 'text' }
            ],
            realtime: true
          }
        ]
      };

      const result = orchestrator.renderPlan(plan);

      expect(result.migrations).toHaveLength(2); // CREATE TABLE + REALTIME
      const realtimeMigration = result.migrations.find(m => m.name.includes('realtime'));
      expect(realtimeMigration).toBeDefined();
      expect(realtimeMigration!.content).toContain('CREATE TRIGGER live_data_insert_trigger');
      expect(realtimeMigration!.content).toContain('notify_live_data_changes()');
    });

    it('should handle foreign key references', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Test table with foreign keys',
        steps: [
          {
            kind: 'table',
            name: 'orders',
            columns: [
              { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
              { name: 'user_id', type: 'uuid', nullable: false, ref: 'users(id)' },
              { name: 'total', type: 'decimal' }
            ]
          }
        ]
      };

      const result = orchestrator.renderPlan(plan);

      expect(result.migrations).toHaveLength(1);
      expect(result.migrations[0].content).toContain('REFERENCES users(id)');
    });
  });

  describe('printSummary', () => {
    it('should print plan summary without errors', () => {
      const plan: Plan = {
        version: 1,
        summary: 'Blog system',
        steps: [
          {
            kind: 'table',
            name: 'posts',
            columns: [
              { name: 'id', type: 'uuid', pk: true },
              { name: 'title', type: 'text' }
            ],
            policy: {
              preset: 'public_read',
              owner_col: 'author_id'
            }
          },
          {
            kind: 'function',
            name: 'notify',
            runtime: 'edge',
            path: '/api/functions/notify.ts'
          }
        ]
      };

      const rendered = orchestrator.renderPlan(plan);
      
      // Should not throw
      expect(() => {
        orchestrator.printSummary(plan, rendered);
      }).not.toThrow();
    });
  });
});