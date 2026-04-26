import type { Metadata } from 'next';
import { query } from '@shared/db';
import { Sidebar } from '@/components/layout/Sidebar';
import { GalleryGrid } from '@/components/gallery';
import type { GalleryMediaItem } from '@/components/gallery';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Galeri foto dan video dari komunitas trader Horizon.',
  alternates: {
    canonical: '/gallery',
  },
};

/** Always fetch fresh data — media is uploaded frequently via Telegram */
export const dynamic = 'force-dynamic';

const INITIAL_LIMIT = 18;

interface MediaRow {
  id: string;
  file_url: string;
  media_type: string;
  created_at: Date;
  article_title: string | null;
  article_slug: string | null;
}

interface CountRow {
  count: string;
}

async function getGalleryMedia(): Promise<{
  items: GalleryMediaItem[];
  totalCount: number;
}> {
  try {
    const [mediaResult, countResult] = await Promise.all([
      query<MediaRow>(
        `SELECT m.id, m.file_url, m.media_type, m.created_at,
                a.title AS article_title, a.slug AS article_slug
         FROM media m
         LEFT JOIN articles a ON m.article_id = a.id AND a.status = 'published'
         ORDER BY m.created_at DESC
         LIMIT $1`,
        [INITIAL_LIMIT]
      ),
      query<CountRow>('SELECT COUNT(*)::text AS count FROM media', []),
    ]);

    const items: GalleryMediaItem[] = mediaResult.rows.map((row) => ({
      id: row.id,
      file_url: row.file_url,
      media_type: row.media_type,
      article_title: row.article_title,
      article_slug: row.article_slug,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    }));

    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10);

    return { items, totalCount };
  } catch {
    return { items: [], totalCount: 0 };
  }
}

export default async function GalleryPage() {
  const { items, totalCount } = await getGalleryMedia();

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1>Gallery</h1>
          </div>
          <GalleryGrid initialItems={items} totalCount={totalCount} />
        </div>
        <Sidebar />
      </div>
    </main>
  );
}
