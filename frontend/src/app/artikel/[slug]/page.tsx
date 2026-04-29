import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query, queryOne } from '@shared/db';
import { Sidebar } from '@/components/layout/Sidebar';
import { ArticleContent } from '@/components/article/ArticleContent';
import { ArticleMeta } from '@/components/article/ArticleMeta';
import { LikeButton } from '@/components/article/LikeButton';
import { CommentSection } from '@/components/article/CommentSection';
import { ShareButtons } from '@/components/article/ShareButtons';
import styles from './page.module.css';

/** ISR revalidation interval in seconds (5 minutes) */
export const revalidate = 300;

interface ArticleRow {
  id: string;
  title: string | null;
  content_html: string;
  category: string;
  slug: string;
  status: string;
  created_at: Date;
  author_name: string | null;
}

interface MediaRow {
  id: string;
  file_url: string;
  media_type: string;
}

interface CountRow {
  count: string;
}

interface ArticleDetail {
  id: string;
  title: string | null;
  content_html: string;
  category: string;
  slug: string;
  created_at: string;
  author_name: string | null;
  media: Array<{ id: string; file_url: string; media_type: string }>;
  commentCount: number;
  likeCount: number;
}

async function getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  try {
    const article = await queryOne<ArticleRow>(
      `SELECT a.id, a.title, a.content_html, a.category,
              a.slug, a.status, a.created_at, u.username AS author_name
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       WHERE a.slug = $1 AND a.status = $2`,
      [slug, 'published']
    );

    if (!article) return null;

    const [mediaResult, commentCountResult, likeCountResult] = await Promise.all([
      query<MediaRow>(
        `SELECT id, file_url, media_type FROM media WHERE article_id = $1 ORDER BY created_at ASC`,
        [article.id]
      ),
      queryOne<CountRow>(
        `SELECT COUNT(*)::text AS count FROM comments WHERE article_id = $1 AND status = $2`,
        [article.id, 'visible']
      ),
      queryOne<CountRow>(
        `SELECT COUNT(*)::text AS count FROM likes WHERE article_id = $1`,
        [article.id]
      ),
    ]);

    return {
      id: article.id,
      title: article.title,
      content_html: article.content_html,
      category: article.category,
      slug: article.slug,
      created_at:
        article.created_at instanceof Date
          ? article.created_at.toISOString()
          : String(article.created_at),
      author_name: article.author_name,
      media: mediaResult.rows,
      commentCount: parseInt(commentCountResult?.count || '0', 10),
      likeCount: parseInt(likeCountResult?.count || '0', 10),
    };
  } catch {
    return null;
  }
}

interface SlugRow {
  slug: string;
}

/** Generate static params for SSG */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const result = await query<SlugRow>(
      `SELECT slug FROM articles WHERE status = $1 ORDER BY created_at DESC LIMIT 100`,
      ['published']
    );
    return result.rows.map((row) => ({ slug: row.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return { title: 'Artikel Tidak Ditemukan' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const articleUrl = `${baseUrl}/artikel/${article.slug}`;

  const plainText = article.content_html.replace(/<[^>]*>/g, '').trim();
  const description = plainText.length > 160
    ? plainText.slice(0, 160).trimEnd() + '…'
    : plainText;

  const title = article.title || description.slice(0, 60);

  // Use first image media as og:image, fallback to platform default
  const firstImage = article.media.find((m) => m.media_type === 'image');
  const ogImage = firstImage?.file_url || `${baseUrl}/images/og-default.svg`;

  return {
    title,
    description,
    alternates: {
      canonical: articleUrl,
    },
    openGraph: {
      title,
      description,
      url: articleUrl,
      type: 'article',
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const displayTitle =
    article.title ||
    article.content_html.replace(/<[^>]*>/g, '').trim().slice(0, 80);

  const plainText = article.content_html.replace(/<[^>]*>/g, '').trim();
  const excerpt = plainText.length > 120
    ? plainText.slice(0, 120).trimEnd() + '…'
    : plainText;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const articleUrl = `${baseUrl}/artikel/${article.slug}`;

  // JSON-LD structured data (Article schema)
  const firstImage = article.media.find((m) => m.media_type === 'image');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: displayTitle,
    description: excerpt,
    image: firstImage?.file_url || `${baseUrl}/images/og-default.svg`,
    datePublished: article.created_at,
    author: {
      '@type': 'Person',
      name: article.author_name || 'Anonim',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Horizon Trader Platform',
    },
    url: articleUrl,
  };

  return (
    <main className={styles.main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={styles.container}>
        <div className={styles.content}>
          <Link href="/" className={styles.backLink}>
            ← Kembali ke Feed
          </Link>

          <article className={styles.article}>
            <h1 className={styles.title}>
              {displayTitle}
            </h1>

            <ArticleMeta
              authorName={article.author_name}
              createdAt={article.created_at}
              contentHtml={article.content_html}
              category={article.category}
            />

            <ArticleContent
              html={article.content_html}
            />

            {article.media.length > 0 && (
              <section className={styles.mediaSection} aria-label="Media artikel">
                <div className={styles.mediaGrid}>
                  {article.media.map((m) => (
                    <div key={m.id} className={styles.mediaItem}>
                      {m.media_type === 'video' ? (
                        <video controls preload="metadata">
                          <source src={m.file_url} />
                          Browser Anda tidak mendukung video.
                        </video>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={m.file_url}
                          alt={article.title || 'Media artikel'}
                          loading="lazy"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className={styles.stats}>
              <LikeButton
                articleId={article.id}
                initialLikeCount={article.likeCount}
              />
              <span className={styles.statItem}>
                💬 {article.commentCount} komentar
              </span>
            </div>

            <ShareButtons
              title={displayTitle}
              excerpt={excerpt}
              url={articleUrl}
            />

            <CommentSection articleId={article.id} />
          </article>
        </div>
        <Sidebar />
      </div>
    </main>
  );
}
