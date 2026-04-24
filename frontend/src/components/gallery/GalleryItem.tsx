'use client';

import Image from 'next/image';
import styles from './GalleryItem.module.css';

export interface GalleryMediaItem {
  id: string;
  file_url: string;
  media_type: string;
  article_title: string | null;
  article_slug: string | null;
  created_at: string;
}

interface GalleryItemProps {
  item: GalleryMediaItem;
  onClick: (item: GalleryMediaItem) => void;
}

const mediaTypeLabels: Record<string, string> = {
  image: 'Foto',
  video: 'Video',
};

export function GalleryItem({ item, onClick }: GalleryItemProps) {
  const isVideo = item.media_type === 'video';

  return (
    <button
      className={styles.item}
      onClick={() => onClick(item)}
      type="button"
      aria-label={`Lihat ${isVideo ? 'video' : 'foto'}${item.article_title ? `: ${item.article_title}` : ''}`}
    >
      <div className={styles.imageWrapper}>
        {isVideo ? (
          <video
            src={item.file_url}
            className={styles.media}
            preload="metadata"
            muted
            playsInline
            aria-hidden="true"
          />
        ) : (
          <Image
            src={item.file_url}
            alt={item.article_title || 'Media gallery'}
            fill
            sizes="(max-width: 768px) 33vw, 300px"
            className={styles.media}
            loading="lazy"
          />
        )}

        {isVideo && (
          <div className={styles.playIcon} aria-hidden="true">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.5)" />
              <polygon points="16,12 30,20 16,28" fill="white" />
            </svg>
          </div>
        )}

        <div className={styles.overlay}>
          <span className={styles.overlayTitle}>
            {item.article_title || 'Tanpa judul'}
          </span>
          <span className={styles.overlayType}>
            {mediaTypeLabels[item.media_type] || item.media_type}
          </span>
        </div>
      </div>
    </button>
  );
}
