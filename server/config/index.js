// Application configuration
module.exports = {
  PORT: process.env.PORT || 8080,
  HOST: process.env.HOST || '0.0.0.0',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL || 'https://kvbppgfwqnwvwubaendh.supabase.co/auth/v1/keys',
  CAPTCHA_PROVIDER: (process.env.CAPTCHA_PROVIDER || '').toLowerCase(),
  CAPTCHA_SECRET: process.env.CAPTCHA_SECRET || '',
  CAPTCHA_REQUIRED: (process.env.CAPTCHA_REQUIRED || 'false') === 'true',
  FORCE_HTTPS: (process.env.FORCE_HTTPS || 'true') === 'true',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
  ALLOWED_CONNECT: process.env.ALLOWED_CONNECT || '',
  ADMIN_IPS: (process.env.ADMIN_IPS || '').split(',').map(s => s.trim()).filter(Boolean),
  LOG_WEBHOOK_URL: process.env.LOG_WEBHOOK_URL || '',
  DB_PATH: process.env.DB_PATH || require('path').join(__dirname, '..', 'blocked_users.db'),
  UPLOAD_DIR: require('path').join(__dirname, '..', 'uploads'),
  MAX_LIMIT: 100
};

