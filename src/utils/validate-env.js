/**
 * Validate required environment variables at startup
 */

const Logger = require('./logger');

const REQUIRED = [
  'DISCORD_TOKEN',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'SECURITY_SALT',
];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    Logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (process.env.SECURITY_SALT.length < 16) {
    Logger.error('SECURITY_SALT must be at least 16 characters');
    process.exit(1);
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    Logger.warn('GROQ_API_KEY not set — AI features will be limited');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DASHBOARD_API_KEY?.trim()) {
    Logger.warn('DASHBOARD_API_KEY not set — dashboard write APIs are disabled in production');
  }
}

module.exports = { validateEnv };
