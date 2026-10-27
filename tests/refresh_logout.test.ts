import request from 'supertest';
import { app } from '../src/app';
import { setupMockDatabase, clearRedisAndDb, inMemoryAuditLogs } from './helpers/mockDb';
import { getRedisClient } from '../src/db/redis';

describe('Features 3 & 4: POST /auth/refresh & POST /auth/logout', () => {
  beforeEach(async () => {
    setupMockDatabase();
    await clearRedisAndDb();

    // Seed test user
    await request(app)
      .post('/auth/register')
      .send({
        email: 'rotate@example.com',
        password: 'Password123!',
        role: 'CANDIDATE'
      });
  });

  it('should rotate refresh token on every use', async () => {
    // 1. Log in
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'rotate@example.com',
        password: 'Password123!'
      });

    const token1 = loginRes.body.tokens.refreshToken;

    // 2. Refresh using token1
    const refreshRes1 = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: token1 });

    expect(refreshRes1.status).toBe(200);
    expect(refreshRes1.body.tokens.accessToken).toBeDefined();
    expect(refreshRes1.body.tokens.refreshToken).toBeDefined();

    const token2 = refreshRes1.body.tokens.refreshToken;
    expect(token2).not.toBe(token1);

    // 3. Refresh using token2 succeeds
    const refreshRes2 = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: token2 });

    expect(refreshRes2.status).toBe(200);
    expect(refreshRes2.body.tokens.refreshToken).toBeDefined();
    expect(refreshRes2.body.tokens.refreshToken).not.toBe(token2);
  });

  it('should detect token reuse and revoke ALL sessions of the user', async () => {
    // 1. Initial Login
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'rotate@example.com',
        password: 'Password123!'
      });

    const token1 = loginRes.body.tokens.refreshToken;
    const userId = loginRes.body.user.id;

    // 2. Legitimate rotation: token1 -> token2
    const refreshRes1 = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: token1 });

    expect(refreshRes1.status).toBe(200);
    const token2 = refreshRes1.body.tokens.refreshToken;

    // 3. Attack scenario: Attacker replays old token1!
    const reuseRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: token1 });

    expect(reuseRes.status).toBe(403);
    expect(reuseRes.body.error).toContain('Refresh token reuse detected');

    // 4. Verify that all sessions for this user were revoked in Redis
    const redis = getRedisClient();
    const activeFamilies = await redis.smembers(`user:sessions:${userId}`);
    expect(activeFamilies.length).toBe(0);

    // 5. Even legitimate token2 is now invalid because all user sessions were wiped
    const followUpRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: token2 });

    expect(followUpRes.status).toBe(403); // Family missing => treated as revoked/security breach
  });

  it('should invalidate refresh token on logout and write audit log', async () => {
    // 1. Log in
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'rotate@example.com',
        password: 'Password123!'
      });

    const refreshToken = loginRes.body.tokens.refreshToken;

    // 2. Log out
    const logoutRes = await request(app)
      .post('/auth/logout')
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe('Logged out successfully');

    // 3. Attempting to refresh with the logged out token must fail
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(403);

    // 4. Verify audit log entry for LOGOUT
    const auditRecord = inMemoryAuditLogs.find((log) => log.action === 'LOGOUT');
    expect(auditRecord).toBeDefined();
  });
});
