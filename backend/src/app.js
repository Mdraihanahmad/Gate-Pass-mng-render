import express from 'express';
import fs from 'fs';
import path from 'path';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import securityRoutes from './routes/security.routes.js';
import adminRoutes from './routes/admin.routes.js';
import visitorRoutes from './routes/visitor.routes.js';
import exportRoutes from './routes/export.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import { notFound, errorHandler } from './middlewares/error.middleware.js';

connectDB();

const app = express();

// Support multiple comma-separated origins for CORS
const rawOrigins = (process.env.CLIENT_URL || '*').trim();
let corsOrigin;
if (!rawOrigins || rawOrigins === '*') {
	// credentials + '*' is invalid in browsers; reflect request origin instead
	corsOrigin = true;
} else {
	const originList = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
	corsOrigin = originList.length > 1 ? originList : originList[0];
}
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(helmet({
	contentSecurityPolicy: false,
	crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve built frontend (Render-friendly single-service deployment)
const publicCandidates = [
	path.resolve(process.cwd(), 'public'),
	path.resolve(process.cwd(), '..', 'public'),
];
const publicDir = publicCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
if (publicDir) {
	app.use(express.static(publicDir));
	// SPA fallback (React Router) - but never hijack API routes
	app.get('*', (req, res, next) => {
		if (req.path.startsWith('/api/')) return next();
		res.sendFile(path.join(publicDir, 'index.html'));
	});
}

app.use(notFound);
app.use(errorHandler);

export default app;
