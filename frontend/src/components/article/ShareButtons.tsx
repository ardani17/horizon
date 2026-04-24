'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import styles from './ShareButtons.module.css';

interface ShareButtonsProps {
  /** Article title for share text */
  title: string;
  /** Short excerpt / description for share text */
  excerpt: string;
  /** Full canonical URL of the article */
  url: string;
}

/**
 * Social sharing buttons for article detail pages.
 *
 * - X (Twitter): opens share URL with title + excerpt + link
 * - Facebook: opens share URL with article link
 * - Threads: opens share URL with text + link
 * - Instagram: copies link to clipboard + shows toast
 * - Copy Link: copies URL to clipboard + shows toast
 *
 * Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.8
 */
export function ShareButtons({ title, excerpt, url }: ShareButtonsProps) {
  const { showToast } = useToast();

  const shareText = `${title}${excerpt ? ` — ${excerpt}` : ''}`;

  const openShareWindow = useCallback((shareUrl: string) => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  }, []);

  const handleShareX = useCallback(() => {
    const text = encodeURIComponent(shareText);
    const link = encodeURIComponent(url);
    openShareWindow(`https://twitter.com/intent/tweet?text=${text}&url=${link}`);
  }, [shareText, url, openShareWindow]);

  const handleShareFacebook = useCallback(() => {
    const link = encodeURIComponent(url);
    openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${link}`);
  }, [url, openShareWindow]);

  const handleShareThreads = useCallback(() => {
    const text = encodeURIComponent(`${shareText} ${url}`);
    openShareWindow(`https://www.threads.net/intent/post?text=${text}`);
  }, [shareText, url, openShareWindow]);

  const handleShareInstagram = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link disalin! Tempel di Instagram Story atau Bio.');
    } catch {
      showToast('Gagal menyalin link.');
    }
  }, [url, showToast]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link artikel berhasil disalin!');
    } catch {
      showToast('Gagal menyalin link.');
    }
  }, [url, showToast]);

  return (
    <div className={styles.shareButtons} aria-label="Bagikan artikel">
      <span className={styles.label}>Bagikan:</span>

      <button
        type="button"
        className={`${styles.shareBtn} ${styles.x}`}
        onClick={handleShareX}
        aria-label="Bagikan ke X (Twitter)"
        title="Bagikan ke X"
      >
        𝕏
      </button>

      <button
        type="button"
        className={`${styles.shareBtn} ${styles.facebook}`}
        onClick={handleShareFacebook}
        aria-label="Bagikan ke Facebook"
        title="Bagikan ke Facebook"
      >
        f
      </button>

      <button
        type="button"
        className={`${styles.shareBtn} ${styles.threads}`}
        onClick={handleShareThreads}
        aria-label="Bagikan ke Threads"
        title="Bagikan ke Threads"
      >
        @
      </button>

      <button
        type="button"
        className={`${styles.shareBtn} ${styles.instagram}`}
        onClick={handleShareInstagram}
        aria-label="Bagikan ke Instagram (salin link)"
        title="Bagikan ke Instagram"
      >
        📷
      </button>

      <button
        type="button"
        className={`${styles.shareBtn} ${styles.copyLink}`}
        onClick={handleCopyLink}
        aria-label="Salin link artikel"
        title="Salin Link"
      >
        🔗
      </button>
    </div>
  );
}
