import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Generate an ephemeral secret in dev if JWT_SECRET is not provided; enforce in production
const devFallbackJwtSecret = crypto.randomBytes(48).toString('hex');
const devFallbackCookieSecret = crypto.randomBytes(32).toString('hex');

if (isProduction && !process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is required in production mode.');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PROD: isProduction,
  PORT: Number(process.env.PORT || 3000),
  CLIENT_URL: process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000',
  APP_URL: process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:3000',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  MONGODB_URI: (process.env.MONGODB_URI || '').trim(),
  JWT_SECRET: process.env.JWT_SECRET || devFallbackJwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_SECRET: process.env.COOKIE_SECRET || devFallbackCookieSecret,
  INITIAL_ADMIN_NAME: process.env.INITIAL_ADMIN_NAME || 'Mahim Dev',
  INITIAL_ADMIN_EMAIL: (process.env.INITIAL_ADMIN_EMAIL || 'admin@mahimdev.com').toLowerCase().trim(),
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || 'Admin@12345',
  CLOUDINARY_CLOUD_NAME: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  CLOUDINARY_API_KEY: (process.env.CLOUDINARY_API_KEY || '').trim(),
  CLOUDINARY_API_SECRET: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  EMAIL_SERVICE_HOST: (process.env.EMAIL_SERVICE_HOST || process.env.SMTP_HOST || '').trim(),
  EMAIL_SERVICE_PORT: Number(process.env.EMAIL_SERVICE_PORT || process.env.SMTP_PORT || 587),
  EMAIL_SERVICE_USER: (process.env.EMAIL_SERVICE_USER || process.env.SMTP_USER || '').trim(),
  EMAIL_SERVICE_PASSWORD: (
    process.env.EMAIL_SERVICE_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    ''
  ).trim(),
  EMAIL_FROM_ADDRESS: (
    process.env.EMAIL_FROM_ADDRESS ||
    process.env.EMAIL_FROM ||
    'hello@mahimdev.com'
  ).trim(),
};

export function isSmtpConfigured(): boolean {
  return Boolean(
    env.EMAIL_SERVICE_HOST &&
      env.EMAIL_SERVICE_USER &&
      env.EMAIL_SERVICE_PASSWORD
  );
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
  );
}
