import { Router } from 'express';
import { auth, requireRoles } from '../middlewares/auth.middleware.js';
import { createVisitor, updateVisitorExit, listVisitors } from '../controllers/visitor.controller.js';
import multer from 'multer';

const router = Router();

router.use(auth, requireRoles('security'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
router.post('/', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'photos', maxCount: 3 }]), createVisitor);
router.patch('/:id/exit', updateVisitorExit);
router.get('/', listVisitors);

export default router;
