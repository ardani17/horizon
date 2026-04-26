import styles from './ArticleContent.module.css';

interface ArticleContentProps {
  html: string;
}

/** Renders article HTML content */
export function ArticleContent({ html }: ArticleContentProps) {
  return (
    <div
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
