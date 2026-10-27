import crypto from 'crypto';
import * as postgres from '../../src/db/postgres';
import { getRedisClient } from '../../src/db/redis';
import { User, UserRole } from '../../src/services/user.service';

export interface AuditRecord {
  id: number;
  user_id: string | null;
  email: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: Date;
}

export const inMemoryUsers: Map<string, User> = new Map();
export const inMemoryAuditLogs: AuditRecord[] = [];
let auditCounter = 1;

export function setupMockDatabase(): void {
  // Clear collections
  inMemoryUsers.clear();
  inMemoryAuditLogs.length = 0;
  auditCounter = 1;

  postgres.setPostgresPool({
    query: async (text: string, params?: any[]) => {
      const sql = text.trim();

      // Health check query
      if (sql.includes('SELECT 1 as healthy')) {
        return { rows: [{ healthy: 1 }], rowCount: 1 };
      }

      // Find by email: SELECT ... FROM users WHERE LOWER(email) = LOWER($1)
      if (sql.includes('FROM users WHERE LOWER(email) = LOWER($1)')) {
        const email = params?.[0]?.toLowerCase();
        const user = Array.from(inMemoryUsers.values()).find(
          (u) => u.email.toLowerCase() === email
        );
        return {
          rows: user ? [{ ...user }] : [],
          rowCount: user ? 1 : 0
        };
      }

      // Find by ID: SELECT ... FROM users WHERE id = $1
      if (sql.includes('FROM users WHERE id = $1')) {
        const id = params?.[0];
        const user = inMemoryUsers.get(id);
        return {
          rows: user ? [{ ...user }] : [],
          rowCount: user ? 1 : 0
        };
      }

      // Insert user: INSERT INTO users ... RETURNING ...
      if (sql.includes('INSERT INTO users')) {
        const email = params?.[0]?.toLowerCase();
        const passwordHash = params?.[1];
        const role: UserRole = params?.[2] || 'CANDIDATE';
        const id = crypto.randomUUID();
        const now = new Date();

        const user: User = {
          id,
          email,
          password_hash: passwordHash,
          role,
          created_at: now,
          updated_at: now
        };
        inMemoryUsers.set(id, user);

        return {
          rows: [{ ...user }],
          rowCount: 1
        };
      }

      // Update password: UPDATE users SET password_hash = $1 ... WHERE id = $2
      if (sql.includes('UPDATE users SET password_hash = $1')) {
        const newHash = params?.[0];
        const id = params?.[1];
        const user = inMemoryUsers.get(id);
        if (user) {
          user.password_hash = newHash;
          user.updated_at = new Date();
        }
        return {
          rows: [],
          rowCount: user ? 1 : 0
        };
      }

      // List users: SELECT id, email, role, created_at, updated_at FROM users
      if (sql.includes('FROM users ORDER BY created_at DESC')) {
        const list = Array.from(inMemoryUsers.values())
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
          .map(({ password_hash: _password_hash, ...rest }) => rest);
        return {
          rows: list,
          rowCount: list.length
        };
      }

      // Insert audit log
      if (sql.includes('INSERT INTO audit_logs')) {
        const record: AuditRecord = {
          id: auditCounter++,
          user_id: params?.[0] || null,
          email: params?.[1] || null,
          action: params?.[2],
          ip_address: params?.[3] || null,
          user_agent: params?.[4] || null,
          metadata: params?.[5] ? JSON.parse(params[5]) : {},
          created_at: new Date()
        };
        inMemoryAuditLogs.push(record);
        return {
          rows: [{ id: record.id }],
          rowCount: 1
        };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => {}
  });
}

export async function clearRedisAndDb(): Promise<void> {
  inMemoryUsers.clear();
  inMemoryAuditLogs.length = 0;
  auditCounter = 1;
  const redis = getRedisClient();
  await redis.flushall();
}
