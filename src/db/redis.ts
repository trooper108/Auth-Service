import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    if (env.NODE_ENV === 'test') {
      // In test environment, default to ioredis-mock to run fully self-contained unit/integration tests
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RedisMock = require('ioredis-mock');
      redisClient = new RedisMock() as Redis;
    } else if (env.REDIS_URL) {
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: false
      });
    } else {
      redisClient = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 3,
        lazyConnect: false
      });
    }

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });
  }
  return redisClient;
}

export function setRedisClient(client: Redis): void {
  redisClient = client;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const res = await client.ping();
    return res === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
