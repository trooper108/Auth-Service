import crypto from 'crypto';
import { getRedisClient } from '../db/redis';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  AccessTokenPayload,
  RefreshTokenPayload
} from '../utils/jwt';
import { logger } from '../utils/logger';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  /**
   * Generates a new access token and refresh token pair, registering the session in Redis.
   */
  public static async generateTokenPair(
    user: AccessTokenPayload
  ): Promise<TokenPair> {
    const familyId = crypto.randomUUID();
    const tokenId = crypto.randomUUID();

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken({
      userId: user.userId,
      familyId,
      tokenId
    });

    const redis = getRedisClient();
    // Save the active token for this family and link family to user sessions
    await redis
      .multi()
      .set(`refresh_token:${familyId}`, tokenId, 'EX', REFRESH_TOKEN_TTL_SECONDS)
      .sadd(`user:sessions:${user.userId}`, familyId)
      .expire(`user:sessions:${user.userId}`, REFRESH_TOKEN_TTL_SECONDS)
      .exec();

    return { accessToken, refreshToken };
  }

  /**
   * Rotates a refresh token. If token reuse is detected, all sessions for that user are revoked.
   */
  public static async rotateRefreshToken(
    rawRefreshToken: string,
    getUserDetails: (userId: string) => Promise<AccessTokenPayload | null>
  ): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    const { userId, familyId, tokenId } = payload;
    const redis = getRedisClient();

    const currentActiveTokenId = await redis.get(`refresh_token:${familyId}`);

    // If family doesn't exist or token ID doesn't match current active token, reuse is detected
    if (!currentActiveTokenId || currentActiveTokenId !== tokenId) {
      logger.warn(
        { userId, familyId, tokenId, currentActiveTokenId },
        'Refresh token reuse detected! Revoking all sessions for user.'
      );
      await this.revokeAllUserSessions(userId);
      throw new Error('TOKEN_REUSE_DETECTED');
    }

    const user = await getUserDetails(userId);
    if (!user) {
      await this.revokeSession(userId, familyId);
      throw new Error('USER_NOT_FOUND');
    }

    // Rotate: Issue new tokenId in the same family
    const newTokenId = crypto.randomUUID();
    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken({
      userId,
      familyId,
      tokenId: newTokenId
    });

    // Record the old token as consumed and update active token to newTokenId
    await redis
      .multi()
      .set(`used_tokens:${tokenId}`, '1', 'EX', 86400) // Keep used tombstone for 1 day
      .set(`refresh_token:${familyId}`, newTokenId, 'EX', REFRESH_TOKEN_TTL_SECONDS)
      .exec();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * Invalidates a single session by family ID.
   */
  public static async revokeSession(userId: string, familyId: string): Promise<void> {
    const redis = getRedisClient();
    await redis
      .multi()
      .del(`refresh_token:${familyId}`)
      .srem(`user:sessions:${userId}`, familyId)
      .exec();
  }

  /**
   * Revokes all active refresh token families for a given user.
   */
  public static async revokeAllUserSessions(userId: string): Promise<void> {
    const redis = getRedisClient();
    const families = await redis.smembers(`user:sessions:${userId}`);
    if (families && families.length > 0) {
      const pipeline = redis.multi();
      for (const fam of families) {
        pipeline.del(`refresh_token:${fam}`);
      }
      pipeline.del(`user:sessions:${userId}`);
      await pipeline.exec();
    }
  }

  /**
   * Invalidate session from a raw refresh token (used by logout).
   */
  public static async invalidateRefreshToken(rawRefreshToken: string): Promise<string | null> {
    try {
      const payload = verifyRefreshToken(rawRefreshToken);
      await this.revokeSession(payload.userId, payload.familyId);
      return payload.userId;
    } catch {
      return null;
    }
  }
}
