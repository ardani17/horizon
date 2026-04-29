import { sanitizeHtml } from '@/lib/sanitize';
import styles from './ArticleContent.module.css';

interface ArticleContentProps {
  html: string;
}

/** Renders article HTML content with XSS sanitization */
export function ArticleContent({ html }: ArticleContentProps) {
  return (
    <div
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
