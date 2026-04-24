'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginWidgetProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: 'write';
  usePic?: boolean;
}

/**
 * Telegram Login Widget — renders the official Telegram login button.
 *
 * When the user authenticates, the widget calls `onAuth` with the
 * user data (id, username, hash, etc.) which can then be verified
 * server-side using HMAC-SHA256 with the bot token.
 */
export function TelegramLoginWidget({
  botName,
  onAuth,
  buttonSize = 'medium',
  cornerRadius,
  usePic = true,
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onAuth);

  // Keep callback ref up to date
  callbackRef.current = onAuth;

  const handleAuth = useCallback((user: TelegramUser) => {
    callbackRef.current(user);
  }, []);

  useEffect(() => {
    // Expose callback on window for the Telegram widget
    const callbackName = `__telegram_login_callback_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callbackName] = handleAuth;

    const container = containerRef.current;
    if (!container) return;

    // Clear any previous widget
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    script.setAttribute('data-userpic', String(usePic));
    if (cornerRadius !== undefined) {
      script.setAttribute('data-radius', String(cornerRadius));
    }

    container.appendChild(script);

    return () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [botName, buttonSize, cornerRadius, usePic, handleAuth]);

  return <div ref={containerRef} />;
}
