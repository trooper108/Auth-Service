import request from 'supertest';
import { app } from '../src/app';
import { setupMockDatabase, clearRedisAndDb, inMemoryAuditLogs, inMemoryUsers } from './helpers/mockDb';
import { verifyPassword } from '../src/utils/crypto';

describe('Feature 1: POST /auth/register & Audit Log', () => {
  beforeEach(async () => {
    setupMockDatabase();
    await clearRedisAndDb();
  });

  it('should register a new user successfully with Argon2 hashed password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123!',
        role: 'CANDIDATE'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User registered successfully');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.role).toBe('CANDIDATE');
    expect(res.body.user.password_hash).toBeUndefined(); // Password hash must never be returned

    // Verify stored user in database has a valid Argon2 hash
    const storedUser = Array.from(inMemoryUsers.values()).find((u) => u.email === 'test@example.com');
    expect(storedUser).toBeDefined();
    expect(storedUser?.password_hash).toContain('$argon2id$');
    const isPasswordValid = await verifyPassword(storedUser!.password_hash, 'Password123!');
    expect(isPasswordValid).toBe(true);

    // Verify Audit Log recorded REGISTER event (Feature 7)
    const auditRecord = inMemoryAuditLogs.find((log) => log.action === 'REGISTER');
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.email).toBe('test@example.com');
  });

  it('should reject registration with invalid email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'invalid-email',
        password: 'Password123!'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'email' })
      ])
    );
  });

  it('should reject registration with password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'shortpass@example.com',
        password: 'short'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'password' })
      ])
    );
  });

  it('should reject duplicate registration with 409 Conflict', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'Password123!'
      });

    const duplicateRes = await request(app)
      .post('/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'Password123!'
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error).toBe('Email is already registered');
  });
});
