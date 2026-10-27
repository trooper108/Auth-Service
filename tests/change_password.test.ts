import request from 'supertest';
import { app } from '../src/app';
import { setupMockDatabase, clearRedisAndDb, inMemoryAuditLogs } from './helpers/mockDb';

describe('Feature 8: POST /auth/change-password', () => {
  let accessToken: string;
  let refreshToken: string;

  beforeEach(async () => {
    setupMockDatabase();
    await clearRedisAndDb();

    // Register user
    await request(app).post('/auth/register').send({
      email: 'changepass@example.com',
      password: 'OldPassword123!',
      role: 'CANDIDATE'
    });

    // Login user
    const loginRes = await request(app).post('/auth/login').send({
      email: 'changepass@example.com',
      password: 'OldPassword123!'
    });

    accessToken = loginRes.body.tokens.accessToken;
    refreshToken = loginRes.body.tokens.refreshToken;
  });

  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/auth/change-password')
      .send({
        currentPassword: 'OldPassword123!',
        newPassword: 'BrandNewPassword123!'
      });

    expect(res.status).toBe(401);
  });

  it('should reject when current password does not match', async () => {
    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'IncorrectPassword!',
        newPassword: 'BrandNewPassword123!'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Current password does not match');
  });

  it('should reject when new password is too short (< 8 chars)', async () => {
    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldPassword123!',
        newPassword: 'short'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should successfully change password, revoke all active sessions, and record audit log', async () => {
    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldPassword123!',
        newPassword: 'BrandNewPassword123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Password changed successfully');

    // 1. Verify audit log entry for PASSWORD_CHANGE (Feature 7)
    const auditRecord = inMemoryAuditLogs.find((log) => log.action === 'PASSWORD_CHANGE');
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.email).toBe('changepass@example.com');

    // 2. Old refresh token should be revoked (all sessions cleared on password change)
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(403);

    // 3. Login with OLD password must fail
    const oldLoginRes = await request(app).post('/auth/login').send({
      email: 'changepass@example.com',
      password: 'OldPassword123!'
    });
    expect(oldLoginRes.status).toBe(401);

    // 4. Login with NEW password must succeed
    const newLoginRes = await request(app).post('/auth/login').send({
      email: 'changepass@example.com',
      password: 'BrandNewPassword123!'
    });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.tokens.accessToken).toBeDefined();
  });
});
