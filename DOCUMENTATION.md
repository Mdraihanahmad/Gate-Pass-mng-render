# Gate Pass System — Documentation (Presentation Ready)

## 1) Project Summary
Gate Pass System is a campus entry/exit tracking web application with three roles:
- **Student**: registers, requests approval, receives a **QR (SID)** + **6-digit PIN**, views history and dashboard insights.
- **Security**: scans student QR or uses PIN/manual entry to record **check-in/check-out**, manages visitor entries, works offline with queued actions.
- **Admin**: approves accounts, manages users, reviews logs/visitors, handles retention purge, monitors/clears overstays, exports reports (PDF/DOCX), and views analytics.

The system stores data in MongoDB (Mongoose) and provides REST APIs via an Express backend. The frontend is a React + Vite + Tailwind PWA.

---

## 2) Tech Stack

### Frontend
- **React 18 + Vite**
- **Tailwind CSS**
- **Axios** API client with auth interceptors
- **PWA** (Vite PWA) + offline caching via **IndexedDB**
- Charts: **Recharts**
- QR scanner: **react-qr-barcode-scanner**

### Backend
- **Node.js + Express** (ESM)
- **MongoDB + Mongoose**
- Auth: **JWT** (`Authorization: Bearer <token>`)
- Security middleware: **Helmet**, CORS, compression, morgan
- File uploads: **multer** (memory storage)
- Media: **Cloudinary** (student profile photos + visitor photos)
- Documents: **PDFKit** + **docx** exports
- QR generation: **qrcode**

---

## 3) System Architecture

### High-level flow
1. **Frontend** calls backend REST endpoints under `/api/*`.
2. **Backend** authenticates requests via JWT and applies role guards.
3. **MongoDB** stores Users, StudentProfiles, Logs, Visitors, Notifications, Overstays.
4. **Background jobs** run inside the backend process:
   - daily retention purge
   - periodic overstay detection + admin notification

### API base path
All APIs are mounted under `/api` in [backend/src/app.js](backend/src/app.js).

---

## 4) Roles & Key Features

### Student
- Signup with details: name, branch, batchYear, registrationNo
- Approval workflow: request approval → wait for admin approval
- After approval:
  - gets a generated **SID** (`studentUid`) used in QR
  - gets a **unique 6-digit PIN** (`pinCode`) as fallback
  - QR code image stored as `qrCodeDataUrl`
- Dashboard:
  - profile summary + QR display
  - log history (check-in/out)
  - PWA offline support: cached profile and logs

### Security
- Records a student **check-in/check-out** via:
  - QR scan (SID)
  - manual entry (SID) or **PIN**
- Enforces a **30-second cooldown** per student to prevent duplicate rapid logs.
- Optionally records “purpose” **only for check-out**.
- Visitor management:
  - creates visitors with up to 3 photos
  - updates exit time
- Offline mode:
  - queues scans/manual/visitor actions in IndexedDB and syncs when online.

### Admin
- Approvals:
  - student approvals (single + batch approve/reject)
  - admin approvals
  - security approvals
- Logs view and filtering
- Visitors view
- User management:
  - delete student/security/admin
  - batch delete students by batchYear (+ optional branch)
- Overstay monitoring:
  - list overstays, resolve manually
  - optional “refresh” (full rescan) to recompute open overstays
- Analytics endpoints: exits by hour/day, top purposes, outside duration avg, overstay trends, approval cycle time, frequent overstayers, etc.
- Exports:
  - logs/overstays/visitors/student-details as **PDF** or **DOCX**

---

## 5) Authentication & Authorization

### JWT auth
- Backend expects: `Authorization: Bearer <token>`
- Token payload: `{ id, registrationNo, role }` (set in middleware)

### Role guards
- Students: `auth` + `requireRoles('student')`
- Security: `auth` + `requireRoles('security')` + `requireApprovedSecurity` for scanning/logging
- Admin: `auth` + `requireRoles('admin')` + `requireApprovedAdmin`

### Frontend session handling
- Token and user object are stored in `localStorage`.
- If backend responds 401/403, frontend clears auth and redirects to `/login`.

---

## 6) API Endpoints (Backend)

Base URL: `/api`

### Health
- `GET /health` → `{ status: 'ok', time: ISO }`

### Auth (`/auth`)
- `POST /auth/signup`
  - Students: must include `registrationNo`, `password`, `role: 'student'`, and student details: `name`, `branch`, `batchYear`.
  - Admin/Security: uses `name` as login identifier, but backend stores `registrationNo` as `registrationNo || name`.
- `POST /auth/login`
  - Student login payload: `{ registrationNo, password }`
  - Admin/Security payload: `{ name, password }`
- `GET /auth/me` (auth)
- `POST /auth/admin/request-approval` (auth)
- `POST /auth/forgot-password`
  - Student: `registrationNo + pinCode` (must be approved)
  - Security: `registrationNo + name` (must be approved)
  - returns reset token for UI flow (no email integration)
- `POST /auth/reset-password` (token)
- `POST /auth/change-password` (auth)

### Student (`/students`) — role: student
- `GET /students/me` → profile + QR + PIN (if approved)
- `GET /students/logs`
- `POST /students/request-approval`
- `PATCH /students/pin` → change PIN (requires approved)
- `PATCH /students/draft` → update name/registrationNo before approval
- `POST /students/profile-photo` → upload (pre-approval only)

### Security (`/security`) — role: security
- `POST /security/request-approval` (unapproved allowed)
- (approved only)
  - `POST /security/scan` → scan QR SID / PIN; records log; returns student summary
  - `POST /security/manual` → manual entry SID / PIN
  - `GET /security/logs`

### Admin (`/admin`) — role: admin (approved)
Approvals
- `GET /admin/students/pending`
- `POST /admin/students/:userId/approve` → generates SID + PIN + QR
- `POST /admin/students/:userId/decline`
- `POST /admin/students/approve-all` (optional filter by batchYear/branch)
- `POST /admin/students/decline-all` (optional filter)

Students / Users
- `GET /admin/students` (approved list)
- `GET /admin/students/search?q=...`
- `GET /admin/students/:registrationNo/details` → `{ student, logs }`
- `DELETE /admin/students/:userId`
- `POST /admin/students/batch-delete`

Security
- `GET /admin/security/pending`
- `POST /admin/security/:userId/approve`
- `POST /admin/security/:userId/decline`
- `DELETE /admin/security/:userId`

Admins
- `GET /admin/admins/pending`
- `POST /admin/admins/:userId/approve`
- `POST /admin/admins/:userId/decline`

Logs / Visitors / Counts
- `GET /admin/logs?from=&to=`
- `GET /admin/visitors?from=&to=`
- `GET /admin/counts?approvedOnly=true|false`
- `GET /admin/users?role=student|security|admin&approvedOnly=true|false`

Maintenance
- `POST /admin/purge-old` (body: `{ months }` or `{ before }`)

Overstays
- `GET /admin/overstays?refresh=true&minHours=6&resolved=false&from=&to=`
- `POST /admin/overstays/:id/resolve`

Analytics
- `GET /admin/analytics/exits-by-hour?from=&to=`
- `GET /admin/analytics/exits-by-day?from=&to=`
- `GET /admin/analytics/avg-outside-duration?from=&to=`
- `GET /admin/analytics/top-purposes?from=&to=`
- `GET /admin/analytics/overstay-trend?from=&to=`
- `GET /admin/analytics/approval-cycle?from=&to=`
- `GET /admin/analytics/current-outside-summary?lookbackHours=...`
- `GET /admin/analytics/overstays-open-resolved?from=&to=`
- `GET /admin/analytics/overstays-by-branch?from=&to=`
- `GET /admin/analytics/frequent-overstayers?from=&to=`

### Visitors (`/visitors`) — role: security
- `POST /visitors` (multipart, supports `photo` or `photos[]` up to 3)
- `PATCH /visitors/:id/exit`
- `GET /visitors` (security view)

### Notifications (`/notifications`) — auth required
- `GET /notifications` (latest first)
- `POST /notifications/read` (mark all read)

### Export (`/export`) — roles: admin/security
- `GET /export/pdf?type=...`
- `GET /export/docx?type=...`

Export types:
- `students` (logs)
- `visitors`
- `overstays`
- `student-details` (includes PIN + SID columns)

---

## 7) Database Models (MongoDB)

### User
Core identity + auth.
- `registrationNo` (unique)
- `passwordHash`
- `role`: `student | security | admin`
- `isApproved`, `requestedApproval`, approval timestamps
- Student-only fields: `studentUid` (SID), `pinCode` (6 digits)
- Profile photo fields: `profilePhotoUrl`, `profilePhotoPublicId`, `profilePhotoLocked`
- Password reset: `resetToken`, `resetTokenExp`

### StudentProfile
- `user` (ref User, unique)
- `name`, `branch`, `batchYear`
- `qrCodeDataUrl` (generated after approval)

### Log
- `registrationNo`, `name`, `branch`, `batchYear`
- `action`: `check-in | check-out`
- `purpose` (only for check-out)
- `timestamp`, `checkInTime`, `checkOutTime`, `recordedBy`
- TTL cleanup is enabled on logs (approx. 90 days)

### Visitor
- `name`, `vehicleNo`, `purpose`
- `entryTime`, `exitTime`
- `createdBy` (security user id)
- Photos stored via Cloudinary: `photoUrl`, `photoPublicId`, and `photos[]`

### Notification
- `user` (ref User)
- `message`, `read`

### Overstay
- Key fields: `registrationNo`, `checkOutTime`, `flaggedAt`, `hoursOutsideAtFlag`
- `resolved`, `resolvedAt`, `checkInTime`
- Used by admin dashboard for alerts and trends

---

## 8) Background Jobs
Jobs start automatically when backend server starts (see [backend/src/server.js](backend/src/server.js)).

### Daily retention purge
- Runs around **03:10 local server time**.
- Deletes logs and visitors older than a cutoff (default 3 months).
- Deletes visitor photos from Cloudinary (student photos are not removed).

### Overstay monitoring
- Runs every **30 minutes** (configurable env vars).
- Flags students whose last action is **check-out** and have been outside longer than threshold (default 6h).
- Creates `Overstay` docs and sends admin `Notification`.

---

## 9) Offline / PWA Behavior
Frontend uses IndexedDB stores in [frontend/src/services/offline.js](frontend/src/services/offline.js) to:
- cache student profile and logs
- cache latest logs/students for dashboards
- queue pending actions for Security when offline:
  - scan
  - manual log
  - visitor create
  - visitor exit

When the device comes online, SecurityDashboard syncs queued actions automatically.

---

## 10) Deployment Notes (Vercel / Render)

### Vercel (frontend)
- Works great for the **React build + static hosting**.
- Vercel also supports Node functions, but this backend has **in-process schedulers** (retention + overstay). Those are better on a persistent server (Render / VPS) unless you migrate jobs to a scheduled worker/cron.
- Vercel runtime logs retention on Hobby is short (Vercel docs mention runtime logs are stored for a limited window).

### Render (backend)
- Suitable for a long-running Express server (jobs can run reliably).
- Free-tier constraints typically include sleeping/cold-starts and limited resources.

Recommended deployment shape for reliability:
- **Frontend** on Vercel
- **Backend** on Render (or similar always-on host)
- **MongoDB Atlas** for database
- **Cloudinary** for photos

---

## 11) Environment Variables (Backend)
These are read in code and should be set in the backend host:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL` (can be comma-separated list)
- Cloudinary:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Retention/overstay tuning:
  - `RETENTION_MONTHS`
  - `OVERSTAY_HOURS`
  - `OVERSTAY_LOOKBACK_HR`
  - `OVERSTAY_INITIAL_DELAY_MS`
  - `OVERSTAY_INTERVAL_MS`
- Export formatting:
  - `TIMEZONE` (default `Asia/Kolkata`)
  - `LOCALE` (default `en-IN`)

Frontend env:
- `VITE_API_BASE` (defaults to `/api`)

---

## 12) How To Run Locally

### Backend
From `backend/`:
1. Install: `npm install`
2. Create `.env` with at least: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`
3. Run dev: `npm run dev`

### Frontend
From `frontend/`:
1. Install: `npm install`
2. Dev: `npm run dev`
3. Build: `npm run build` (copies build output into `public/`)

---

## 13) Security Notes (Current + Next Improvements)
What’s already present:
- JWT auth with role checks
- Helmet baseline enabled
- 30-second duplicate log cooldown per student in security scan/manual
- PIN is required to be exactly 6 digits; PIN uniqueness enforced

High-impact improvements (recommended next):
- Rate-limiting / brute-force protection for:
  - `/api/auth/login`
  - security scan/manual endpoints
  - PIN change endpoints
- Audit log for admin actions (approvals, deletes)
- Stronger password rules and optional MFA for admins

