import { Router } from 'express';
import { auth } from '../middlewares/auth.middleware.js';
import { myNotifications, markRead } from '../controllers/notification.controller.js';

const router = Router();
router.use(auth);
router.get('/', myNotifications);
router.post('/read', markRead);

export default router;
