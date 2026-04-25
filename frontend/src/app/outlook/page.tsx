import type { Metadata } from 'next';
import { query } from '@shared/db';
import { Sidebar } from '@/components/layout/Sidebar';
import { OutlookCard } from '@/components/outlook';
import type { OutlookCardData } from '@/components/outlook';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Outlook',
  description: 'Analisa market mendalam dari komunitas trader Horizon.',
  alternates: {
    canonical: '/outlook',
  },
};

interface OutlookRow {
  id: string;
  title: string | null;
  content_html: string;
  slug: string;
  created_at: Date;
  author_name: string | null;
  cover_image: string | null;
}

async function getOutlookArticles(): Promise<OutlookCardData[]> {
  try {
    const result = await query<OutlookRow>(
      `SELECT a.id, a.title, a.content_html, a.slug, a.created_at,
              u.username AS author_name,
              (SELECT m.file_url FROM media m WHERE m.article_id = a.id AND m.media_type = 'image' ORDER BY m.created_at ASC LIMIT 1) AS cover_image
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE a.status = $1 AND a.category = $2
       ORDER BY a.created_at DESC`,
      ['published', 'outlook']
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content_html: row.content_html,
      slug: row.slug,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      author_name: row.author_name,
      cover_image: row.cover_image,
    }));
  } catch {
    return [];
  }
}

export default async function OutlookPage() {
  const articles = await getOutlookArticles();

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1>Outlook</h1>
            <p className={styles.description}>
              Analisa market mendalam dari para trader komunitas Horizon.
            </p>
          </div>

          {articles.length > 0 ? (
            <div className={styles.list}>
              {articles.map((article) => (
                <OutlookCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📊</div>
              <p className={styles.emptyText}>Belum ada artikel Outlook</p>
              <p className={styles.emptySubtext}>
                Analisa market akan ditampilkan di sini.
              </p>
            </div>
          )}
        </div>
        <Sidebar />
      </div>
    </main>
  );
}
