'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { TelegramLoginWidget, type TelegramUser } from '@/components/auth/TelegramLoginWidget';
import styles from './CommentSection.module.css';

interface CommentData {
  id: string;
  display_name: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  user_id: string | null;
}

interface CommentSectionProps {
  articleId: string;
  telegramBotName?: string;
}

/** Format a date string to a human-readable format */
function formatCommentDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * CommentSection — displays chronological comments (oldest first)
 * and provides a form to submit new comments, either anonymously
 * or authenticated via Telegram Login Widget.
 */
export function CommentSection({ articleId, telegramBotName }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [authMode, setAuthMode] = useState<'anonymous' | 'telegram'>('anonymous');
  const [displayName, setDisplayName] = useState('');
  const [content, setContent] = useState('');

  // Telegram auth state
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);

  const botName = telegramBotName || process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '';

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?article_id=${articleId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setComments(data.data);
      }
    } catch {
      // Silently fail — comments are non-critical
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Restore Telegram session from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('horizon_telegram_user');
      if (stored) {
        const user = JSON.parse(stored) as TelegramUser;
        setTelegramUser(user);
        setAuthMode('telegram');
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleTelegramAuth = useCallback((user: TelegramUser) => {
    setTelegramUser(user);
    setAuthMode('telegram');
    localStorage.setItem('horizon_telegram_user', JSON.stringify(user));
  }, []);

  const handleTelegramLogout = useCallback(() => {
    setTelegramUser(null);
    setAuthMode('anonymous');
    localStorage.removeItem('horizon_telegram_user');
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Isi komentar tidak boleh kosong.');
      return;
    }

    if (trimmedContent.length > 2000) {
      setError('Komentar maksimal 2000 karakter.');
      return;
    }

    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        article_id: articleId,
        content: trimmedContent,
      };

      if (authMode === 'anonymous') {
        body.is_anonymous = true;
        body.display_name = displayName.trim() || 'Anonim';
      } else if (telegramUser) {
        body.is_anonymous = false;
        body.telegram_auth = {
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          username: telegramUser.username,
          photo_url: telegramUser.photo_url,
          auth_date: telegramUser.auth_date,
          hash: telegramUser.hash,
        };
      }

      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Gagal mengirim komentar.');
        return;
      }

      // Add new comment to list
      setComments((prev) => [...prev, data.data]);
      setContent('');
      setDisplayName('');
      setSuccess('Komentar berhasil dikirim!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Gagal mengirim komentar. Coba lagi nanti.');
    } finally {
      setSubmitting(false);
    }
  }, [articleId, authMode, content, displayName, telegramUser]);

  return (
    <section className={styles.section} aria-label="Komentar">
      <h2 className={styles.heading}>
        💬 Komentar ({loading ? '…' : comments.length})
      </h2>

      {/* Comment List */}
      {loading ? (
        <div className={styles.emptyComments}>Memuat komentar…</div>
      ) : comments.length === 0 ? (
        <div className={styles.emptyComments}>
          Belum ada komentar. Jadilah yang pertama berkomentar!
        </div>
      ) : (
        <div className={styles.commentList} role="list">
          {comments.map((comment) => (
            <div key={comment.id} className={styles.comment} role="listitem">
              <div className={styles.commentHeader}>
                <span className={styles.commentAuthor}>
                  {comment.display_name}
                </span>
                {!comment.is_anonymous && comment.user_id && (
                  <span className={styles.memberBadge} aria-label="Member terverifikasi">
                    ✓ Member
                  </span>
                )}
                <time
                  className={styles.commentDate}
                  dateTime={comment.created_at}
                >
                  {formatCommentDate(comment.created_at)}
                </time>
              </div>
              <p className={styles.commentContent}>{comment.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Comment Form */}
      <div className={styles.formSection}>
        <h3 className={styles.formTitle}>Tulis Komentar</h3>

        {/* Auth mode selection */}
        <div className={styles.authOptions}>
          <button
            type="button"
            className={`${styles.authOption} ${authMode === 'anonymous' ? styles.authOptionActive : ''}`}
            onClick={() => setAuthMode('anonymous')}
          >
            ✏️ Komentar Anonim
          </button>
          <button
            type="button"
            className={`${styles.authOption} ${authMode === 'telegram' ? styles.authOptionActive : ''}`}
            onClick={() => setAuthMode('telegram')}
          >
            📱 Login via Telegram
          </button>
        </div>

        {/* Telegram auth section */}
        {authMode === 'telegram' && (
          <div className={styles.telegramAuth}>
            {telegramUser ? (
              <div className={styles.telegramUser}>
                <span>
                  Logged in sebagai{' '}
                  <strong>
                    {telegramUser.username
                      ? `@${telegramUser.username}`
                      : telegramUser.first_name}
                  </strong>
                </span>
                <button
                  type="button"
                  className={styles.telegramLogout}
                  onClick={handleTelegramLogout}
                >
                  Logout
                </button>
              </div>
            ) : botName ? (
              <TelegramLoginWidget
                botName={botName}
                onAuth={handleTelegramAuth}
                buttonSize="medium"
              />
            ) : (
              <p className={styles.errorMessage}>
                Telegram Login belum dikonfigurasi.
              </p>
            )}
          </div>
        )}

        {/* Comment form */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Display name field (only for anonymous mode) */}
          {authMode === 'anonymous' && (
            <div className={styles.fieldGroup}>
              <label htmlFor="comment-name" className={styles.label}>
                Nama Tampilan (opsional)
              </label>
              <input
                id="comment-name"
                type="text"
                className={styles.input}
                placeholder="Anonim"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="comment-content" className={styles.label}>
              Komentar
            </label>
            <textarea
              id="comment-content"
              className={styles.textarea}
              placeholder="Tulis komentar Anda…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              required
            />
          </div>

          {error && <p className={styles.errorMessage} role="alert">{error}</p>}
          {success && <p className={styles.successMessage} role="status">{success}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting || (authMode === 'telegram' && !telegramUser)}
          >
            {submitting ? 'Mengirim…' : 'Kirim Komentar'}
          </button>
        </form>
      </div>
    </section>
  );
}
