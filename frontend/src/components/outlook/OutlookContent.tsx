import styles from './OutlookContent.module.css';

interface OutlookContentProps {
  html: string;
}

/** Renders Outlook article HTML with full-width content, large typography, and inline images */
export function OutlookContent({ html }: OutlookContentProps) {
  return (
    <div
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
