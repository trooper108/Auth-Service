import request from 'supertest';
import { app } from '../src/app';
import { setupMockDatabase, clearRedisAndDb } from './helpers/mockDb';
import * as postgres from '../src/db/postgres';
import * as redis from '../src/db/redis';

describe('Health Check (GET /health)', () => {
  beforeEach(async () => {
    setupMockDatabase();
    await clearRedisAndDb();
  });

  it('should return 200 with status ok when both Postgres and Redis are healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      services: {
        postgres: 'up',
        redis: 'up'
      }
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it('should return 503 degraded if Postgres is down', async () => {
    postgres.setPostgresPool({
      query: async () => {
        throw new Error('Postgres connection failed');
      },
      end: async () => {}
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded',
      services: {
        postgres: 'down',
        redis: 'up'
      }
    });
  });

  it('should return 503 degraded if Redis is down', async () => {
    const redisClient = redis.getRedisClient();
    jest.spyOn(redisClient, 'ping').mockRejectedValueOnce(new Error('Redis connection failed'));

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded',
      services: {
        postgres: 'up',
        redis: 'down'
      }
    });
  });
});
