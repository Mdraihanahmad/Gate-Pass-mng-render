import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, registrationNo, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// Ensure security users are approved before accessing security routes
export const requireApprovedSecurity = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'security') return res.status(403).json({ message: 'Forbidden' });
  const user = await User.findById(req.user.id).select('isApproved');
  if (!user) return res.status(403).json({ message: 'Your security account was removed' });
  if (!user.isApproved) return res.status(403).json({ message: 'Security account not approved yet' });
    next();
  } catch (e) {
    next(e);
  }
};

// Ensure admins are approved before accessing admin routes
export const requireApprovedAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const user = await User.findById(req.user.id).select('isApproved');
    if (!user || !user.isApproved) return res.status(403).json({ message: 'Admin account not approved yet' });
    next();
  } catch (e) { next(e); }
};
