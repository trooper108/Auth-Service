import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/security.service';
import { env } from '../config/env';

export function ipRateLimiter(
  maxRequests: number = env.RATE_LIMIT_MAX_REQUESTS,
  windowSeconds: number = env.RATE_LIMIT_WINDOW_SECONDS
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const result = await SecurityService.checkRateLimit('ip', ip, maxRequests, windowSeconds);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetSeconds);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.resetSeconds);
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: result.resetSeconds
      });
      return;
    }

    next();
  };
}

export function loginRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const email = (req.body?.email as string)?.trim().toLowerCase();

    // Check rate limit per IP
    const ipResult = await SecurityService.checkRateLimit(
      'login:ip',
      ip,
      env.LOGIN_RATE_LIMIT_MAX_REQUESTS,
      env.RATE_LIMIT_WINDOW_SECONDS
    );

    if (!ipResult.allowed) {
      res.setHeader('Retry-After', ipResult.resetSeconds);
      res.status(429).json({
        error: 'Too many login attempts from this IP. Please wait before retrying.',
        retryAfter: ipResult.resetSeconds
      });
      return;
    }

    // Check rate limit per email if provided
    if (email) {
      const emailResult = await SecurityService.checkRateLimit(
        'login:email',
        email,
        env.LOGIN_RATE_LIMIT_MAX_REQUESTS,
        env.RATE_LIMIT_WINDOW_SECONDS
      );

      if (!emailResult.allowed) {
        res.setHeader('Retry-After', emailResult.resetSeconds);
        res.status(429).json({
          error: 'Too many login attempts for this account. Please wait before retrying.',
          retryAfter: emailResult.resetSeconds
        });
        return;
      }
    }

    next();
  };
}
