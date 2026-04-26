'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ArticleFormData, MediaAttachment } from '@/components/admin';

/** Dynamic import for ArticleEditor — heavy rich text editor loaded on demand */
const ArticleEditor = dynamic(
  () => import('@/components/admin/ArticleEditor').then((mod) => ({ default: mod.ArticleEditor })),
  { ssr: false }
);
import styles from '../../articles.module.css';

interface ArticleData {
  id: string;
  title: string | null;
  content_html: string;
  category: string;
  status: string;
  slug: string;
  source: string;
  author_username: string | null;
  created_at: string;
}

interface MediaData {
  id: string;
  file_url: string;
  media_type: 'image' | 'video';
  file_key: string | null;
  file_size: number | null;
  created_at: string;
}

/**
 * Admin Edit Article Page
 *
 * Edit form with ArticleEditor for content_html and metadata.
 * Loads existing article data and media attachments.
 *
 * Requirements: 5.2, 5.3
 */
export default function AdminEditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<ArticleData | null>(null);
  const [media, setMedia] = useState<MediaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/articles/${articleId}`);
        const json = await res.json();
        if (json.success) {
          setArticle(json.data.article);
          setMedia(json.data.media || []);
        } else {
          setError(json.error?.message || 'Artikel tidak ditemukan');
        }
      } catch {
        setError('Gagal memuat artikel');
      } finally {
        setLoading(false);
      }
    }

    fetchArticle();
  }, [articleId]);

  const handleSubmit = async (data: ArticleFormData, newFiles: File[]) => {
    setSubmitting(true);
    try {
      // 1. Update the article
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Gagal memperbarui artikel');
      }

      // 2. Upload new media files if any
      for (const file of newFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('article_id', articleId);

        await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });
      }

      // 3. Redirect to articles list
      router.push('/admin/articles');
    } catch (err) {
      setSubmitting(false);
      throw err;
    }
  };

  if (loading) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <Link href="/admin/articles" className={styles.backLink}>
            ← Kembali
          </Link>
          <h2>Edit Artikel</h2>
        </div>
        <div className={styles.editorCard}>
          <p>Memuat artikel...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <Link href="/admin/articles" className={styles.backLink}>
            ← Kembali
          </Link>
          <h2>Edit Artikel</h2>
        </div>
        <div className={styles.editorCard}>
          <p style={{ color: 'var(--color-danger)' }}>{error || 'Artikel tidak ditemukan'}</p>
        </div>
      </div>
    );
  }

  const initialMedia: MediaAttachment[] = media.map((m) => ({
    id: m.id,
    file_url: m.file_url,
    media_type: m.media_type,
  }));

  return (
    <div>
      <div className={styles.pageHeader}>
        <Link href="/admin/articles" className={styles.backLink}>
          ← Kembali
        </Link>
        <h2>Edit Artikel</h2>
      </div>
      <div className={styles.editorCard}>
        <ArticleEditor
          initialData={{
            title: article.title || '',
            content_html: article.content_html,
            category: article.category,
            status: article.status,
          }}
          initialMedia={initialMedia}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/admin/articles')}
          submitLabel="Simpan Perubahan"
          submitting={submitting}
        />
      </div>
    </div>
  );
}
