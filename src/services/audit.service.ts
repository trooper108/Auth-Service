import { query } from '../db/postgres';
import { logger } from '../utils/logger';

export type AuditAction =
  | 'REGISTER'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'ACCOUNT_LOCKOUT'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE';

export interface AuditEventParams {
  userId?: string | null;
  email?: string | null;
  action: AuditAction;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

export class AuditService {
  public static async log(event: AuditEventParams): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs (user_id, email, action, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          event.userId || null,
          event.email || null,
          event.action,
          event.ipAddress || null,
          event.userAgent || null,
          JSON.stringify(event.metadata || {})
        ]
      );
    } catch (err) {
      // Audit log failures should not crash the primary auth flow, but must be logged
      logger.error({ err, event }, 'Failed to write audit log entry');
    }
  }
}
