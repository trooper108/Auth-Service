import request from 'supertest';
import { app } from '../src/app';
import { setupMockDatabase, clearRedisAndDb, inMemoryAuditLogs } from './helpers/mockDb';
import { verifyAccessToken, verifyRefreshToken } from '../src/utils/jwt';
import { getRedisClient } from '../src/db/redis';

describe('Feature 2: POST /auth/login & Audit Log', () => {
  beforeEach(async () => {
    setupMockDatabase();
    await clearRedisAndDb();

    // Seed test user
    await request(app)
      .post('/auth/register')
      .send({
        email: 'user@example.com',
        password: 'ValidPassword123!',
        role: 'CANDIDATE'
      });
  });

  it('should successfully log in and return 15-minute access token and refresh token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'ValidPassword123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.tokens).toBeDefined();
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();

    // Verify access token contents and 15-minute validity
    const accessPayload = verifyAccessToken(res.body.tokens.accessToken);
    expect(accessPayload.email).toBe('user@example.com');
    expect(accessPayload.role).toBe('CANDIDATE');
    expect(accessPayload.userId).toBeDefined();

    // Verify refresh token
    const refreshPayload = verifyRefreshToken(res.body.tokens.refreshToken);
    expect(refreshPayload.userId).toBe(accessPayload.userId);
    expect(refreshPayload.familyId).toBeDefined();
    expect(refreshPayload.tokenId).toBeDefined();

    // Verify session stored in Redis
    const redis = getRedisClient();
    const storedTokenId = await redis.get(`refresh_token:${refreshPayload.familyId}`);
    expect(storedTokenId).toBe(refreshPayload.tokenId);

    // Verify audit log recorded LOGIN_SUCCESS
    const auditRecord = inMemoryAuditLogs.find((log) => log.action === 'LOGIN_SUCCESS');
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.email).toBe('user@example.com');
  });

  it('should return 401 and audit log LOGIN_FAILURE when password is wrong', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'WrongPassword999!'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');

    // Verify audit log recorded LOGIN_FAILURE
    const auditRecord = inMemoryAuditLogs.find((log) => log.action === 'LOGIN_FAILURE');
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.email).toBe('user@example.com');
  });

  it('should return 401 when email does not exist', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('should reject login with invalid request body schema', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'not-an-email'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});
