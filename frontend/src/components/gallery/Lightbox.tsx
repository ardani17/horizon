'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { GalleryMediaItem } from './GalleryItem';
import styles from './Lightbox.module.css';

interface LightboxProps {
  item: GalleryMediaItem;
  onClose: () => void;
}

export function Lightbox({ item, onClose }: LightboxProps) {
  const isVideo = item.media_type === 'video';

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Media: ${item.article_title || 'Tanpa judul'}`}
    >
      <div className={styles.content}>
        <button
          className={styles.closeButton}
          onClick={onClose}
          type="button"
          aria-label="Tutup lightbox"
        >
          ✕
        </button>

        <div className={styles.mediaContainer}>
          {isVideo ? (
            <video
              src={item.file_url}
              className={styles.video}
              controls
              autoPlay
              playsInline
            >
              Browser Anda tidak mendukung video.
            </video>
          ) : (
            <div className={styles.imageContainer}>
              <Image
                src={item.file_url}
                alt={item.article_title || 'Media gallery'}
                fill
                sizes="90vw"
                className={styles.image}
                priority
              />
            </div>
          )}
        </div>

        {item.article_title && (
          <div className={styles.caption}>
            <span className={styles.captionTitle}>{item.article_title}</span>
          </div>
        )}
      </div>
    </div>
  );
}
