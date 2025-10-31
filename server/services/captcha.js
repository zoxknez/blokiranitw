// Captcha verification service
const config = require('../config');

async function verifyCaptcha(token, ip) {
  if (!config.CAPTCHA_REQUIRED) return true;
  if (!config.CAPTCHA_SECRET) return false;
  
  try {
    if (config.CAPTCHA_PROVIDER === 'turnstile') {
      const params = new URLSearchParams();
      params.append('secret', config.CAPTCHA_SECRET);
      params.append('response', token || '');
      if (ip) params.append('remoteip', ip);
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { 
        method: 'POST', 
        body: params 
      });
      const data = await r.json();
      return !!data.success;
    }
    
    if (config.CAPTCHA_PROVIDER === 'recaptcha') {
      const params = new URLSearchParams();
      params.append('secret', config.CAPTCHA_SECRET);
      params.append('response', token || '');
      if (ip) params.append('remoteip', ip);
      const r = await fetch('https://www.google.com/recaptcha/api/siteverify', { 
        method: 'POST', 
        body: params 
      });
      const data = await r.json();
      return !!data.success;
    }
    
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  verifyCaptcha
};

