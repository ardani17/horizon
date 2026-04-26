import type { Metadata } from 'next';
import { query } from '@shared/db';
import { Sidebar } from '@/components/layout/Sidebar';
import { FeedList } from '@/components/feed';
import type { ArticleCardData } from '@/components/feed';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Feed',
  description: 'Artikel terbaru dari komunitas trader Horizon — jurnal trading, cerita kehidupan, dan lainnya.',
  alternates: {
    canonical: '/',
  },
};

/** Always fetch fresh data — articles are created frequently via Telegram */
export const dynamic = 'force-dynamic';

interface ArticleRow {
  id: string;
  title: string | null;
  content_html: string;
  category: string;
  slug: string;
  created_at: Date;
  author_name: string | null;
}

async function getPublishedArticles(): Promise<ArticleCardData[]> {
  try {
    const result = await query<ArticleRow>(
      `SELECT a.id, a.title, a.content_html, a.category, a.slug, a.created_at, u.username AS author_name
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE a.status = $1 AND a.category != $2
       ORDER BY a.created_at DESC`,
      ['published', 'outlook']
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content_html: row.content_html,
      category: row.category,
      slug: row.slug,
      created_at: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
      author_name: row.author_name,
    }));
  } catch {
    // In development or when DB is unavailable, return empty array
    return [];
  }
}

export default async function FeedPage() {
  const articles = await getPublishedArticles();

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1>Feed</h1>
          </div>
          <FeedList articles={articles} />
        </div>
        <Sidebar />
      </div>
    </main>
  );
}
