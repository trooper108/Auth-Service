import { Request, Response } from 'express';
import { checkPostgresHealth } from '../db/postgres';
import { checkRedisHealth } from '../db/redis';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const [pgHealthy, redisHealthy] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth()
  ]);

  const allHealthy = pgHealthy && redisHealthy;
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ok' : 'degraded',
    services: {
      postgres: pgHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down'
    },
    timestamp: new Date().toISOString()
  });
}
