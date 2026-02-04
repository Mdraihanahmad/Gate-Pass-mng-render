import { Router } from 'express';
import { auth, requireRoles, requireApprovedSecurity } from '../middlewares/auth.middleware.js';
import { scanQr, manualEntry, listLogs, requestApproval } from '../controllers/security.controller.js';

const router = Router();

router.use(auth, requireRoles('security'));
// Allow unapproved security to request approval
router.post('/request-approval', requestApproval);
// Everything else requires approved security
router.use(requireApprovedSecurity);
router.post('/scan', scanQr);
router.post('/manual', manualEntry);
router.get('/logs', listLogs);

export default router;
