import { Router } from 'express';
import { auth, requireRoles } from '../middlewares/auth.middleware.js';
import { myProfile, myLogs, requestApproval, changePin, uploadProfilePhoto, updateStudentDraft } from '../controllers/student.controller.js';
import multer from 'multer';

const router = Router();

router.use(auth, requireRoles('student'));
router.get('/me', myProfile);
router.get('/logs', myLogs);
router.post('/request-approval', requestApproval);
router.patch('/pin', changePin);
router.patch('/draft', updateStudentDraft);
// Upload profile photo
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.post('/profile-photo', upload.single('photo'), uploadProfilePhoto);

export default router;
