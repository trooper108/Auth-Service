import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

export async function getUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await UserService.listUsers();
    res.status(200).json({
      total: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
}
