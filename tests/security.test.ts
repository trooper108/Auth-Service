import request from 'supertest';
import { app } from '../src/app';
import { setupMockDatabase, clearRedisAndDb, inMemoryAuditLogs } from './helpers/mockDb';
import { env } from '../src/config/env';

describe('Feature 6: Security (Rate limiting, 15-min lockout on 5 failed logins, Helmet, CORS)', () => {
  beforeEach(async () => {
    setupMockDatabase();
    await clearRedisAndDb();

    // Seed test user
    await request(app).post('/auth/register').send({
      email: 'target@example.com',
      password: 'CorrectPassword123!',
      role: 'CANDIDATE'
    });
  });

  describe('Account Lockout (15 minutes after 5 failed logins)', () => {
    it('should lock the account for 15 minutes upon the 5th failed login attempt', async () => {
      // 4 consecutive failed attempts
      for (let i = 1; i <= 4; i++) {
        const failRes = await request(app).post('/auth/login').send({
          email: 'target@example.com',
          password: 'WrongPassword!'
        });
        expect(failRes.status).toBe(401);
      }

      // 5th failed attempt -> locks account
      const fifthRes = await request(app).post('/auth/login').send({
        email: 'target@example.com',
        password: 'WrongPassword!'
      });
      expect(fifthRes.status).toBe(423); // 423 Locked
      expect(fifthRes.body.error).toContain('Account locked');
      expect(fifthRes.body.details?.remainingSeconds).toBe(900);

      // Verify audit log has ACCOUNT_LOCKOUT
      const lockoutAudit = inMemoryAuditLogs.find((l) => l.action === 'ACCOUNT_LOCKOUT');
      expect(lockoutAudit).toBeDefined();
      expect(lockoutAudit?.email).toBe('target@example.com');
      expect(lockoutAudit?.metadata?.lockoutDurationSeconds).toBe(900);

      // Even providing the correct password now must still be rejected while locked
      const correctWhileLocked = await request(app).post('/auth/login').send({
        email: 'target@example.com',
        password: 'CorrectPassword123!'
      });
      expect(correctWhileLocked.status).toBe(423);
      expect(correctWhileLocked.body.error).toContain('Account is temporarily locked');
    });
  });

  describe('Rate Limiting (Redis-backed)', () => {
    it('should rate limit per email after exceeding login rate limit threshold', async () => {
      // Config: env.LOGIN_RATE_LIMIT_MAX_REQUESTS = 10
      for (let i = 0; i < env.LOGIN_RATE_LIMIT_MAX_REQUESTS; i++) {
        await request(app).post('/auth/login').send({
          email: 'ratelimit@example.com',
          password: 'SomePassword!'
        });
      }

      // Request 11 should be blocked by login rate limiter
      const blockedRes = await request(app).post('/auth/login').send({
        email: 'ratelimit@example.com',
        password: 'SomePassword!'
      });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toContain('Too many login attempts');
      expect(blockedRes.headers['retry-after']).toBeDefined();
    });
  });

  describe('Security Headers & CORS', () => {
    it('should include Helmet security headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('should respect CORS configuration', async () => {
      const res = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
