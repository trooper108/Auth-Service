import { Router } from 'express';
import { z } from 'zod';
import {
  register,
  login,
  refresh,
  logout,
  changePassword
} from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { loginRateLimiter } from '../middleware/rateLimiter.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const registerSchema = {
  body: z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    role: z.enum(['ADMIN', 'RECRUITER', 'CANDIDATE']).optional()
  })
};

const loginSchema = {
  body: z.object({
    email: z.string().email('Valid email is required'),
    password: z.string().min(1, 'Password is required')
  })
};

const tokenSchema = {
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
};

const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long')
  })
};

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', loginRateLimiter(), validateRequest(loginSchema), login);
router.post('/refresh', validateRequest(tokenSchema), refresh);
router.post('/logout', validateRequest(tokenSchema), logout);
router.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  changePassword
);

export default router;
