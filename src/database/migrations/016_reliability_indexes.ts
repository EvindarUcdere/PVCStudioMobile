import { DatabaseMigration } from './types';

export const reliabilityIndexesMigration: DatabaseMigration = {
  id: '016_reliability_indexes',
  async up(database) {
    await database.execAsync(`
      DELETE FROM quotes
      WHERE id NOT IN (
        SELECT keep_id
        FROM (
          SELECT
            q.design_id,
            COALESCE(
              (
                SELECT p.quote_id
                FROM payment_plans p
                JOIN quotes qp ON qp.id = p.quote_id
                WHERE qp.design_id = q.design_id
                ORDER BY p.updated_at DESC
                LIMIT 1
              ),
              (
                SELECT q2.id
                FROM quotes q2
                WHERE q2.design_id = q.design_id
                ORDER BY q2.updated_at DESC
                LIMIT 1
              )
            ) AS keep_id
          FROM quotes q
          GROUP BY q.design_id
        )
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_design_id_unique
      ON quotes(design_id);
    `);
  },
};
