import { Router } from 'express';
import { getUsers } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.get('/users', authenticate, requireRole('ADMIN'), getUsers);

export default router;
