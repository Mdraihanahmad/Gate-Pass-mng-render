// Centralized security hardening layer (non-breaking)
// Adds Helmet with a conservative baseline and selective rate limiting.
// All settings are override-able with environment variables.

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Global Helmet middleware (minimal breaking risk)
const enableCsp = String(process.env.ENABLE_CSP || '').toLowerCase() === 'true';
const self = "'self'";
const cspDirectives = {
  defaultSrc: [self],
  scriptSrc: [self],
  styleSrc: [self, "'unsafe-inline'"], // allow inline styles (can tighten later with hash)
  imgSrc: [self, 'data:', 'blob:'],
  connectSrc: [self, '*'], // if you know exact API domains, replace '*'
  objectSrc: [self],
  frameAncestors: [self],
  baseUri: [self],
};
export const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: enableCsp ? { directives: cspDirectives } : false,
});

// Generic small burst limiter factory
const makeLimiter = (opts) => rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  ...opts,
});

// Auth specific limits (tunable via env)
const windowMs = Number(process.env.RATE_WINDOW_MS || 10 * 60 * 1000); // 10m default
const maxLogin = Number(process.env.RATE_MAX_LOGIN || 30); // per window
const maxReset = Number(process.env.RATE_MAX_RESET || 10);

export const loginLimiter = makeLimiter({ windowMs, max: maxLogin });
export const resetLimiter = makeLimiter({ windowMs, max: maxReset });

// Placeholder for future body schema validation (Zod) without enforcing yet
export const noopValidator = () => (req, _res, next) => next();
