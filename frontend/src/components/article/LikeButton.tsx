'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './LikeButton.module.css';

interface LikeButtonProps {
  articleId: string;
  initialLikeCount: number;
}

/**
 * Generate a simple browser fingerprint from user agent, screen resolution,
 * and timezone. This is not meant to be a robust fingerprint — just enough
 * to deduplicate casual likes per device/browser.
 */
function generateFingerprint(): string {
  const raw = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');

  // Simple hash (djb2)
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}

/** Like button with fingerprint-based deduplication */
export function LikeButton({ articleId, initialLikeCount }: LikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  // Generate fingerprint on mount (client-side only)
  useEffect(() => {
    const fp = generateFingerprint();
    setFingerprint(fp);

    // Check if this fingerprint already liked this article
    const likedArticles: string[] = JSON.parse(
      localStorage.getItem('horizon_likes') || '[]'
    );
    if (likedArticles.includes(articleId)) {
      setLiked(true);
    }
  }, [articleId]);

  const toggleLike = useCallback(async () => {
    if (!fingerprint || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, fingerprint }),
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.success) {
        setLiked(data.data.liked);
        setLikeCount(data.data.like_count);

        // Persist liked state in localStorage
        const likedArticles: string[] = JSON.parse(
          localStorage.getItem('horizon_likes') || '[]'
        );
        if (data.data.liked) {
          if (!likedArticles.includes(articleId)) {
            likedArticles.push(articleId);
          }
        } else {
          const idx = likedArticles.indexOf(articleId);
          if (idx !== -1) likedArticles.splice(idx, 1);
        }
        localStorage.setItem('horizon_likes', JSON.stringify(likedArticles));
      }
    } catch {
      // Silently fail — like is non-critical
    } finally {
      setLoading(false);
    }
  }, [articleId, fingerprint, loading]);

  return (
    <button
      type="button"
      className={`${styles.likeButton} ${liked ? styles.liked : ''}`}
      onClick={toggleLike}
      disabled={loading || !fingerprint}
      aria-label={liked ? 'Batal suka artikel ini' : 'Suka artikel ini'}
      aria-pressed={liked}
    >
      <span className={styles.heart} aria-hidden="true">
        {liked ? '❤️' : '🤍'}
      </span>
      <span className={styles.count}>{likeCount} suka</span>
    </button>
  );
}
