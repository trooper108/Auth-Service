import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role } = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const user = await AuthService.register(email, password, role, ip, userAgent);
    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.login(email, password, ip, userAgent);
    res.status(200).json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    const tokens = await AuthService.refreshToken(refreshToken);
    res.status(200).json({
      message: 'Token refreshed successfully',
      tokens
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await AuthService.logout(refreshToken, ip, userAgent);
    res.status(200).json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await AuthService.changePassword(userId, currentPassword, newPassword, ip, userAgent);
    res.status(200).json({
      message: 'Password changed successfully. All sessions revoked; please log in again.'
    });
  } catch (error) {
    next(error);
  }
}
