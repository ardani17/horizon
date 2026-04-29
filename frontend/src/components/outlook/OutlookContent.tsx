import { sanitizeHtml } from '@/lib/sanitize';
import styles from './OutlookContent.module.css';

interface OutlookContentProps {
  html: string;
}

/** Renders Outlook article HTML with XSS sanitization */
export function OutlookContent({ html }: OutlookContentProps) {
  return (
    <div
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
