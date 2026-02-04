import { Router } from 'express';
import { auth, requireRoles } from '../middlewares/auth.middleware.js';
import { exportPdf, exportDocx } from '../controllers/export.controller.js';

const router = Router();

router.use(auth, requireRoles('admin', 'security'));
router.get('/pdf', exportPdf);
router.get('/docx', exportDocx);

export default router;
