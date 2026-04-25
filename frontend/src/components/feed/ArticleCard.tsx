import Link from 'next/link';
import styles from './ArticleCard.module.css';

export interface ArticleCardData {
  id: string;
  title: string | null;
  content_html: string;
  category: string;
  content_type: string;
  slug: string;
  created_at: string;
  author_name: string | null;
}

interface ArticleCardProps {
  article: ArticleCardData;
}

const categoryLabels: Record<string, string> = {
  trading: 'Trading Room',
  life_story: 'Life & Coffee',
  general: 'General',
  outlook: 'Outlook',
};

function getExcerpt(html: string, maxLength = 150): string {
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Card component for short content articles */
export function ArticleCard({ article }: ArticleCardProps) {
  const excerpt = getExcerpt(article.content_html);
  const displayTitle = article.title || excerpt.slice(0, 60);

  return (
    <article className={styles.card}>
      <div className={styles.meta}>
        <span className={styles.category}>
          {categoryLabels[article.category] || article.category}
        </span>
        <time className={styles.date} dateTime={article.created_at}>
          {formatDate(article.created_at)}
        </time>
      </div>

      <h3 className={styles.title}>
        <Link href={`/artikel/${article.slug}`} className={styles.titleLink}>
          {displayTitle}
        </Link>
      </h3>

      <p className={styles.excerpt}>{excerpt}</p>

      <div className={styles.footer}>
        <span className={styles.author}>
          oleh <strong>{article.author_name || 'Anonim'}</strong>
        </span>
      </div>
    </article>
  );
}
