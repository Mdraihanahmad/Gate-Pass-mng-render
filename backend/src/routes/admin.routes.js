import { Router } from 'express';
import { auth, requireRoles, requireApprovedAdmin } from '../middlewares/auth.middleware.js';
import { listPendingStudents, approveStudent, listStudents, listLogs, listVisitors, listPendingSecurity, approveSecurity, declineStudent, declineSecurity, deleteStudent, deleteStudentsBatch, listPendingAdmins, approveAdmin, declineAdmin, getUserCounts, listUsers, deleteSecurity, batchApproveStudents, batchDeclineStudents, purgeOldData, listOverstays, resolveOverstay, searchStudents, getStudentDetails } from '../controllers/admin.controller.js';
import { exitsByHour, exitsByDay, avgOutsideDuration, topPurposes, overstayTrend, approvalCycle, currentOutsideSummary, overstaysOpenResolved, overstaysByBranch, frequentOverstayers } from '../controllers/analytics.controller.js';

const router = Router();

router.use(auth, requireRoles('admin'), requireApprovedAdmin);

router.get('/students/pending', listPendingStudents);
router.post('/students/:userId/approve', approveStudent);
router.post('/students/:userId/decline', declineStudent);
router.post('/students/approve-all', batchApproveStudents);
router.post('/students/decline-all', batchDeclineStudents);
router.delete('/students/:userId', deleteStudent);
router.post('/students/batch-delete', deleteStudentsBatch);
router.get('/security/pending', listPendingSecurity);
router.post('/security/:userId/approve', approveSecurity);
router.post('/security/:userId/decline', declineSecurity);
router.delete('/security/:userId', deleteSecurity);
router.get('/students', listStudents);
router.get('/logs', listLogs);
router.get('/visitors', listVisitors);
router.get('/counts', getUserCounts);
router.get('/users', listUsers);
router.get('/students/search', searchStudents);
router.get('/students/:registrationNo/details', getStudentDetails);
router.post('/purge-old', purgeOldData);
// Overstays
router.get('/overstays', listOverstays);
router.post('/overstays/:id/resolve', resolveOverstay);

// Analytics
router.get('/analytics/exits-by-hour', exitsByHour);
router.get('/analytics/exits-by-day', exitsByDay);
router.get('/analytics/avg-outside-duration', avgOutsideDuration);
router.get('/analytics/top-purposes', topPurposes);
router.get('/analytics/overstay-trend', overstayTrend);
router.get('/analytics/approval-cycle', approvalCycle);
router.get('/analytics/current-outside-summary', currentOutsideSummary);
router.get('/analytics/overstays-open-resolved', overstaysOpenResolved);
router.get('/analytics/overstays-by-branch', overstaysByBranch);
router.get('/analytics/frequent-overstayers', frequentOverstayers);

// Admin approval endpoints
router.get('/admins/pending', listPendingAdmins);
router.post('/admins/:userId/approve', approveAdmin);
router.post('/admins/:userId/decline', declineAdmin);

export default router;
