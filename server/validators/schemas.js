// Zod validation schemas
const { z } = require('zod');
const { isAllowedProfileUrl } = require('../utils/validation');

const SuggestionItemSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url().refine(isAllowedProfileUrl, 'Only Twitter/X profile URLs are allowed')
});

const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionItemSchema).min(1).max(50),
  captchaToken: z.string().optional()
});

const UserUpsertSchema = z.object({
  username: z.string().min(1).max(50),
  profile_url: z.string().url().refine(isAllowedProfileUrl, 'Only Twitter/X profile URLs are allowed')
});

module.exports = {
  SuggestionItemSchema,
  SuggestionsSchema,
  UserUpsertSchema
};

