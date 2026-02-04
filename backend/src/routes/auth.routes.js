import { Router } from 'express';
import { signup, login, me, requestAdminApproval, forgotPassword, resetPassword, changePassword } from '../controllers/auth.controller.js';
import { auth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', auth, me);
router.post('/admin/request-approval', auth, requestAdminApproval);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', auth, changePassword);

export default router;
