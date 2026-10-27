import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let pool: any = null;

export function getPostgresPool(): Pool {
  if (!pool) {
    if (env.DATABASE_URL) {
      pool = new Pool({
        connectionString: env.DATABASE_URL
      });
    } else {
      pool = new Pool({
        host: env.PGHOST,
        port: env.PGPORT,
        user: env.PGUSER,
        password: env.PGPASSWORD,
        database: env.PGDATABASE
      });
    }

    pool.on('error', (err: any) => {
      logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
    });
  }
  return pool;
}

export function setPostgresPool(customPool: any): void {
  pool = customPool;
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const p = getPostgresPool();
  return p.query(text, params);
}

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    const res = await query('SELECT 1 as healthy');
    return res && res.rows && res.rows.length > 0;
  } catch (err) {
    logger.error({ err }, 'PostgreSQL health check failed');
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool && typeof pool.end === 'function') {
    await pool.end();
  }
  pool = null;
}
