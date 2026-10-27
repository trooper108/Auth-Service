import { UserService, User, UserRole } from './user.service';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { TokenService, TokenPair } from './token.service';
import { SecurityService } from './security.service';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/error.middleware';

export interface AuthSuccessResult {
  user: Omit<User, 'password_hash'>;
  tokens: TokenPair;
}

export class AuthService {
  public static async register(
    email: string,
    passwordPlain: string,
    role: UserRole = 'CANDIDATE',
    ipAddress?: string,
    userAgent?: string
  ): Promise<Omit<User, 'password_hash'>> {
    const existing = await UserService.findByEmail(email);
    if (existing) {
      throw new AppError('Email is already registered', 409);
    }

    const passwordHash = await hashPassword(passwordPlain);
    const user = await UserService.create(email, passwordHash, role);

    await AuditService.log({
      userId: user.id,
      email: user.email,
      action: 'REGISTER',
      ipAddress,
      userAgent,
      metadata: { role: user.role }
    });

    const { password_hash: _password_hash, ...sanitized } = user;
    return sanitized;
  }

  public static async login(
    email: string,
    passwordPlain: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthSuccessResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if account is locked
    const lockout = await SecurityService.isAccountLocked(normalizedEmail);
    if (lockout.isLocked) {
      throw new AppError(
        `Account is temporarily locked due to too many failed attempts. Try again in ${Math.ceil(
          lockout.remainingSeconds / 60
        )} minutes.`,
        423,
        { remainingSeconds: lockout.remainingSeconds }
      );
    }

    const user = await UserService.findByEmail(normalizedEmail);

    let passwordValid = false;
    if (user) {
      passwordValid = await verifyPassword(user.password_hash, passwordPlain);
    }

    if (!user || !passwordValid) {
      const failResult = await SecurityService.recordFailedLogin(
        normalizedEmail,
        ipAddress,
        userAgent
      );

      await AuditService.log({
        userId: user ? user.id : undefined,
        email: normalizedEmail,
        action: 'LOGIN_FAILURE',
        ipAddress,
        userAgent,
        metadata: { attempt: failResult.attempts }
      });

      if (failResult.locked) {
        throw new AppError(
          `Account locked after ${failResult.attempts} failed attempts. Please try again after 15 minutes.`,
          423,
          { remainingSeconds: failResult.remainingSeconds }
        );
      }

      throw new AppError('Invalid email or password', 401);
    }

    // Reset failed counter on successful authentication
    await SecurityService.clearFailedLogins(normalizedEmail);

    const tokens = await TokenService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    await AuditService.log({
      userId: user.id,
      email: user.email,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent
    });

    const { password_hash: _password_hash, ...sanitized } = user;
    return { user: sanitized, tokens };
  }

  public static async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      return await TokenService.rotateRefreshToken(refreshToken, async (userId) => {
        const user = await UserService.findById(userId);
        if (!user) return null;
        return {
          userId: user.id,
          email: user.email,
          role: user.role
        };
      });
    } catch (err: any) {
      if (err.message === 'TOKEN_REUSE_DETECTED') {
        throw new AppError('Security violation: Refresh token reuse detected. All sessions revoked.', 403);
      }
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  public static async logout(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const userId = await TokenService.invalidateRefreshToken(refreshToken);
    if (userId) {
      await AuditService.log({
        userId,
        action: 'LOGOUT',
        ipAddress,
        userAgent
      });
    }
  }

  public static async changePassword(
    userId: string,
    currentPasswordPlain: string,
    newPasswordPlain: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const user = await UserService.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isCurrentValid = await verifyPassword(user.password_hash, currentPasswordPlain);
    if (!isCurrentValid) {
      throw new AppError('Current password does not match', 400);
    }

    const newHash = await hashPassword(newPasswordPlain);
    await UserService.updatePassword(userId, newHash);

    // Revoke all existing sessions to enforce re-login with the new password
    await TokenService.revokeAllUserSessions(userId);

    await AuditService.log({
      userId: user.id,
      email: user.email,
      action: 'PASSWORD_CHANGE',
      ipAddress,
      userAgent
    });
  }
}
