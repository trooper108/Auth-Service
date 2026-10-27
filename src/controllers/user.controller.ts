import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { AppError } from '../middleware/error.middleware';

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const user = await UserService.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const { password_hash: _password_hash, ...sanitized } = user;
    res.status(200).json({ user: sanitized });
  } catch (error) {
    next(error);
  }
}
