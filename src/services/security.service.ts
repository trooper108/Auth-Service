import { getRedisClient } from '../db/redis';
import { env } from '../config/env';
import { AuditService } from './audit.service';

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
}

export class SecurityService {
  /**
   * Checks if an email account is currently locked out.
   */
  public static async isAccountLocked(email: string): Promise<LockoutStatus> {
    const redis = getRedisClient();
    const key = `account_locked:${email.toLowerCase()}`;
    const ttl = await redis.ttl(key);

    if (ttl > 0) {
      return { isLocked: true, remainingSeconds: ttl };
    }
    return { isLocked: false, remainingSeconds: 0 };
  }

  /**
   * Records a failed login attempt for an email. Locks account for 15 minutes if threshold is hit.
   */
  public static async recordFailedLogin(
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ attempts: number; locked: boolean; remainingSeconds: number }> {
    const redis = getRedisClient();
    const normalizedEmail = email.toLowerCase();
    const countKey = `failed_logins:count:${normalizedEmail}`;
    const lockKey = `account_locked:${normalizedEmail}`;

    const attempts = await redis.incr(countKey);
    // Set a window of 15 minutes for failed attempts
    if (attempts === 1) {
      await redis.expire(countKey, env.LOGIN_LOCKOUT_DURATION_SECONDS);
    }

    if (attempts >= env.LOGIN_MAX_FAILED_ATTEMPTS) {
      await redis.set(lockKey, 'locked', 'EX', env.LOGIN_LOCKOUT_DURATION_SECONDS);
      await redis.del(countKey);

      await AuditService.log({
        email: normalizedEmail,
        action: 'ACCOUNT_LOCKOUT',
        ipAddress,
        userAgent,
        metadata: {
          attempts,
          lockoutDurationSeconds: env.LOGIN_LOCKOUT_DURATION_SECONDS
        }
      });

      return {
        attempts,
        locked: true,
        remainingSeconds: env.LOGIN_LOCKOUT_DURATION_SECONDS
      };
    }

    return {
      attempts,
      locked: false,
      remainingSeconds: 0
    };
  }

  /**
   * Clears failed login counter and lockout upon successful authentication.
   */
  public static async clearFailedLogins(email: string): Promise<void> {
    const redis = getRedisClient();
    const normalizedEmail = email.toLowerCase();
    await redis.del(
      `failed_logins:count:${normalizedEmail}`,
      `account_locked:${normalizedEmail}`
    );
  }

  /**
   * Evaluates Redis-backed rate limiting using a counter with expiration.
   */
  public static async checkRateLimit(
    keyPrefix: string,
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
    const redis = getRedisClient();
    const key = `rate_limit:${keyPrefix}:${identifier}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    const resetSeconds = ttl > 0 ? ttl : windowSeconds;

    if (current > maxRequests) {
      return { allowed: false, remaining: 0, resetSeconds };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - current),
      resetSeconds
    };
  }
}
