import styles from './ArticleMeta.module.css';

interface ArticleMetaProps {
  authorName: string | null;
  createdAt: string;
  contentHtml: string;
  category: string;
  contentType: string;
}

const categoryLabels: Record<string, string> = {
  trading: 'Trading Room',
  life_story: 'Life & Coffee',
  general: 'General',
  outlook: 'Outlook',
};

/** Estimate read time from HTML content (average 200 words per minute) */
export function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Displays article metadata: author, date, read time, category */
export function ArticleMeta({
  authorName,
  createdAt,
  contentHtml,
  category,
  contentType,
}: ArticleMetaProps) {
  const readTime = estimateReadTime(contentHtml);

  return (
    <div className={styles.meta}>
      <div className={styles.badges}>
        <span className={styles.category}>
          {categoryLabels[category] || category}
        </span>
        {contentType === 'long' && (
          <span className={styles.longBadge}>Long Read</span>
        )}
      </div>
      <div className={styles.details}>
        <span className={styles.author}>
          oleh <strong>{authorName || 'Anonim'}</strong>
        </span>
        <span className={styles.separator} aria-hidden="true">·</span>
        <time className={styles.date} dateTime={createdAt}>
          {formatDate(createdAt)}
        </time>
        <span className={styles.separator} aria-hidden="true">·</span>
        <span className={styles.readTime}>{readTime} menit baca</span>
      </div>
    </div>
  );
}
