import express from 'express';
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
const rawOrigins = process.env.CLIENT_URL || '*';
const originList = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
const corsOrigin = originList.length > 1 ? originList : originList[0];
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

app.use(notFound);
app.use(errorHandler);

export default app;
