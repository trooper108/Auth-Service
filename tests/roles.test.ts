import request from 'supertest';
import { app } from '../src/app';
import { setupMockDatabase, clearRedisAndDb } from './helpers/mockDb';

describe('Feature 5: Roles & Role-check Middleware (GET /me and GET /admin/users)', () => {
  let adminToken: string;
  let recruiterToken: string;
  let candidateToken: string;

  beforeEach(async () => {
    setupMockDatabase();
    await clearRedisAndDb();

    // Register ADMIN
    await request(app).post('/auth/register').send({
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      role: 'ADMIN'
    });
    const adminLogin = await request(app).post('/auth/login').send({
      email: 'admin@example.com',
      password: 'AdminPassword123!'
    });
    adminToken = adminLogin.body.tokens.accessToken;

    // Register RECRUITER
    await request(app).post('/auth/register').send({
      email: 'recruiter@example.com',
      password: 'RecruiterPassword123!',
      role: 'RECRUITER'
    });
    const recruiterLogin = await request(app).post('/auth/login').send({
      email: 'recruiter@example.com',
      password: 'RecruiterPassword123!'
    });
    recruiterToken = recruiterLogin.body.tokens.accessToken;

    // Register CANDIDATE
    await request(app).post('/auth/register').send({
      email: 'candidate@example.com',
      password: 'CandidatePassword123!',
      role: 'CANDIDATE'
    });
    const candidateLogin = await request(app).post('/auth/login').send({
      email: 'candidate@example.com',
      password: 'CandidatePassword123!'
    });
    candidateToken = candidateLogin.body.tokens.accessToken;
  });

  describe('GET /me (accessible to any authenticated user)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authorization header with Bearer token is required');
    });

    it('should return profile for CANDIDATE', async () => {
      const res = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('candidate@example.com');
      expect(res.body.user.role).toBe('CANDIDATE');
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('should return profile for RECRUITER', async () => {
      const res = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('recruiter@example.com');
      expect(res.body.user.role).toBe('RECRUITER');
    });

    it('should return profile for ADMIN', async () => {
      const res = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@example.com');
      expect(res.body.user.role).toBe('ADMIN');
    });
  });

  describe('GET /admin/users (restricted to ADMIN role only)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/admin/users');
      expect(res.status).toBe(401);
    });

    it('should reject CANDIDATE with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden: Insufficient permissions');
      expect(res.body.requiredRoles).toContain('ADMIN');
    });

    it('should reject RECRUITER with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden: Insufficient permissions');
    });

    it('should allow ADMIN to retrieve the users list', async () => {
      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.users).toHaveLength(3);
      expect(res.body.users[0].password_hash).toBeUndefined();
    });
  });
});
