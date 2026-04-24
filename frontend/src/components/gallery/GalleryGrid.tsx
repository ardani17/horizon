'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GalleryItem, type GalleryMediaItem } from './GalleryItem';
import styles from './GalleryGrid.module.css';

/** Dynamic import for Lightbox — heavy modal component loaded on demand */
const Lightbox = dynamic(
  () => import('./Lightbox').then((mod) => ({ default: mod.Lightbox })),
  { ssr: false }
);

const ITEMS_PER_PAGE = 18;

interface GalleryGridProps {
  initialItems: GalleryMediaItem[];
  totalCount: number;
}

export function GalleryGrid({ initialItems, totalCount }: GalleryGridProps) {
  const [items, setItems] = useState<GalleryMediaItem[]>(initialItems);
  const [lightboxItem, setLightboxItem] = useState<GalleryMediaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length < totalCount);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const offset = items.length;
      const res = await fetch(`/api/gallery?offset=${offset}&limit=${ITEMS_PER_PAGE}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      const newItems: GalleryMediaItem[] = data.data?.items ?? [];

      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...newItems]);
        if (offset + newItems.length >= totalCount) {
          setHasMore(false);
        }
      }
    } catch {
      // Silently fail — user can scroll again to retry
    } finally {
      setLoading(false);
    }
  }, [items.length, loading, hasMore, totalCount]);

  useEffect(() => {
    if (!hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loadMore]);

  function handleItemClick(item: GalleryMediaItem) {
    setLightboxItem(item);
  }

  function handleCloseLightbox() {
    setLightboxItem(null);
  }

  if (items.length === 0) {
    return (
      <div className={`retro-box ${styles.empty}`}>
        <p className={styles.emptyText}>Belum ada media di gallery.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid} role="list" aria-label="Gallery media">
        {items.map((item) => (
          <div key={item.id} role="listitem">
            <GalleryItem item={item} onClick={handleItemClick} />
          </div>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className={styles.loadingTrigger}>
          {loading && <span className={styles.loadingText}>Memuat media...</span>}
        </div>
      )}

      {lightboxItem && (
        <Lightbox item={lightboxItem} onClose={handleCloseLightbox} />
      )}
    </div>
  );
}
