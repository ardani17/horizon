'use client';

import styles from './SkeletonLoader.module.css';

interface SkeletonLoaderProps {
  /** Layout variant matching the page structure */
  variant: 'feed' | 'gallery' | 'article';
}

/**
 * Skeleton loading placeholders matching page layouts.
 * Prevents layout shift while content loads.
 *
 * Requirements: 19.8
 */
export function SkeletonLoader({ variant }: SkeletonLoaderProps) {
  switch (variant) {
    case 'feed':
      return <FeedSkeleton />;
    case 'gallery':
      return <GallerySkeleton />;
    case 'article':
      return <ArticleSkeleton />;
    default:
      return null;
  }
}

function FeedSkeleton() {
  return (
    <div className={styles.container} aria-busy="true" aria-label="Memuat konten...">
      {/* Category tabs skeleton */}
      <div className={styles.tabsRow}>
        <div className={`${styles.bone} ${styles.tab}`} />
        <div className={`${styles.bone} ${styles.tab}`} />
        <div className={`${styles.bone} ${styles.tab}`} />
      </div>

      {/* Article card skeletons */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.card}>
          <div className={`${styles.bone} ${styles.cardTitle}`} />
          <div className={`${styles.bone} ${styles.cardMeta}`} />
          <div className={`${styles.bone} ${styles.cardLine}`} />
          <div className={`${styles.bone} ${styles.cardLineShort}`} />
        </div>
      ))}
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className={styles.container} aria-busy="true" aria-label="Memuat gallery...">
      <div className={styles.galleryGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={`${styles.bone} ${styles.galleryItem}`} />
        ))}
      </div>
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div className={styles.container} aria-busy="true" aria-label="Memuat artikel...">
      <div className={styles.articleBox}>
        <div className={`${styles.bone} ${styles.articleTitle}`} />
        <div className={`${styles.bone} ${styles.articleMeta}`} />
        <div className={styles.articleBody}>
          <div className={`${styles.bone} ${styles.articleLine}`} />
          <div className={`${styles.bone} ${styles.articleLine}`} />
          <div className={`${styles.bone} ${styles.articleLine}`} />
          <div className={`${styles.bone} ${styles.articleLineShort}`} />
        </div>
      </div>
    </div>
  );
}
