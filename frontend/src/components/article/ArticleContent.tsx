import styles from './ArticleContent.module.css';

interface ArticleContentProps {
  html: string;
  contentType: string;
}

/** Renders article HTML content with appropriate styling based on content type */
export function ArticleContent({ html, contentType }: ArticleContentProps) {
  const layoutClass =
    contentType === 'long' ? styles.longContent : styles.shortContent;

  return (
    <div
      className={`${styles.content} ${layoutClass}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
