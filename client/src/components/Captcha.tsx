import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: any;
  }
}

interface CaptchaProps {
  onToken: (token: string | null) => void;
  siteKey?: string;
}

const Captcha: React.FC<CaptchaProps> = ({ onToken, siteKey }) => {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const sitekey = siteKey || process.env.REACT_APP_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!sitekey) {
      onToken(null);
      return;
    }
    const ensureScript = () => {
      const id = 'cf-turnstile-script';
      if (document.getElementById(id)) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const s = document.createElement('script');
        s.id = id;
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        document.body.appendChild(s);
      });
    };

    let widgetId: any = null;
    ensureScript().then(() => {
      if (!window.turnstile || !widgetRef.current) return;
      widgetId = window.turnstile.render(widgetRef.current, {
        sitekey: sitekey,
        theme: 'auto',
        callback: (token: string) => onToken(token),
        'error-callback': () => onToken(null),
        'expired-callback': () => onToken(null)
      });
    });

    return () => {
      try {
        if (window.turnstile && widgetId) {
          window.turnstile.reset(widgetId);
        }
      } catch {}
    };
  }, [onToken, siteKey, sitekey]);

  if (!sitekey) return null;

  return (
    <div className="mt-2">
      <div ref={widgetRef} />
    </div>
  );
};

export default Captcha;


