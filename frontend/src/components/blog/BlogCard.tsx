import Link from 'next/link';
import styles from './BlogCard.module.css';
import { estimateReadTime, formatDate } from '@/components/article/ArticleMeta';

export interface BlogCardData {
  id: string;
  title: string | null;
  content_html: string;
  slug: string;
  created_at: string;
  author_name: string | null;
  cover_image: string | null;
}

interface BlogCardProps {
  article: BlogCardData;
}

function getExcerpt(html: string, maxLength = 200): string {
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/** Card component for Blog articles with badge and cover image thumbnail */
export function BlogCard({ article }: BlogCardProps) {
  const excerpt = getExcerpt(article.content_html);
  const displayTitle = article.title || excerpt.slice(0, 80);
  const readTime = estimateReadTime(article.content_html);

  return (
    <article className={styles.card}>
      <div className={styles.thumbnail}>
        {article.cover_image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={article.cover_image}
            alt={displayTitle}
            className={styles.thumbnailImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.thumbnailPlaceholder} aria-hidden="true">
            📝
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.badge}>Blog</span>
          <time className={styles.date} dateTime={article.created_at}>
            {formatDate(article.created_at)}
          </time>
        </div>

        <h3 className={styles.title}>
          <Link href={`/blog/${article.slug}`} className={styles.titleLink}>
            {displayTitle}
          </Link>
        </h3>

        <p className={styles.excerpt}>{excerpt}</p>

        <div className={styles.footer}>
          <span className={styles.author}>
            oleh <strong>{article.author_name || 'Anonim'}</strong>
          </span>
          <span className={styles.readTime}>{readTime} menit baca</span>
        </div>
      </div>
    </article>
  );
}
