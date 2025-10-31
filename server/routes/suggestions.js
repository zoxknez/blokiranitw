// Suggestions routes
const express = require('express');
const { z } = require('zod');
const { authenticateToken, ensureJson } = require('../middleware/auth');
const { verifyCaptcha } = require('../services/captcha');
const { isAllowedProfileUrl } = require('../utils/validation');
const createAuditService = require('../services/audit');
const db = require('../db').getDb();

const router = express.Router();
const { writeAudit } = createAuditService(db);

// Rate limiter
const { suggestLimiter } = require('../middleware/rateLimiter');

const SuggestionItemSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url().refine(isAllowedProfileUrl, 'Only Twitter/X profile URLs are allowed')
});

const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionItemSchema).min(1).max(50),
  captchaToken: z.string().optional()
});

// Submit suggestions (auth required, batch up to 50)
router.post('/', suggestLimiter, authenticateToken, ensureJson, async (req, res) => {
  const CAPTCHA_REQUIRED = (process.env.CAPTCHA_REQUIRED || 'false') === 'true';
  const parse = SuggestionsSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  const { suggestions, captchaToken } = parse.data;
  
  if (CAPTCHA_REQUIRED) {
    const ok = await verifyCaptcha(captchaToken, req.ip);
    if (!ok) return res.status(400).json({ error: 'Captcha verification failed' });
  }

  // Support single object fallback
  let items = Array.isArray(suggestions) ? suggestions : [];

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Provide suggestions array or username and profile_url' });
  }

  if (items.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 suggestions per submission' });
  }

  // Basic validation and normalization
  const normalized = items
    .map((it) => ({
      username: (it.username || '').trim().replace(/^@/, ''),
      profile_url: (it.profile_url || '').trim()
    }))
    .filter((it) => it.username && it.profile_url && isAllowedProfileUrl(it.profile_url));

  if (normalized.length === 0) {
    return res.status(400).json({ error: 'No valid items found' });
  }

  const stmt = db.prepare("INSERT INTO user_suggestions (username, profile_url, reason, suggested_by) VALUES (?, ?, ?, ?)");
  let inserted = 0;
  let errors = 0;
  const suggestedBy = req.user?.username || 'Anonymous';

  let completed = 0;
  normalized.forEach((it) => {
    stmt.run([it.username, it.profile_url, '', suggestedBy], (err) => {
      if (err) {
        errors++;
      } else {
        inserted++;
      }
      completed++;
      if (completed === normalized.length) {
        stmt.finalize();
        writeAudit('suggestions.create', suggestedBy, String(inserted), { errors, total: normalized.length });
        return res.status(201).json({
          message: 'Suggestions submitted. They will be reviewed by an administrator.',
          inserted,
          errors,
          total: normalized.length
        });
      }
    });
  });
});

module.exports = router;

