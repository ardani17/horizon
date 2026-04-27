'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { OutlookFormData, InlineImageEntry } from '@/components/admin/OutlookEditor';

/** Dynamic import for OutlookEditor — heavy rich text editor loaded on demand */
const OutlookEditor = dynamic(
  () => import('@/components/admin/OutlookEditor').then((mod) => ({ default: mod.OutlookEditor })),
  { ssr: false }
);
import styles from '../../outlook.module.css';

interface OutlookArticleData {
  id: string;
  title: string | null;
  content_html: string;
  status: string;
  slug: string;
  source: string;
  author_username: string | null;
  created_at: string;
}

/**
 * Admin Edit Outlook Article Page
 *
 * Loads an existing Outlook article and renders it in the OutlookEditor
 * with initialData for editing. Handles inline image uploads on save.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
export default function AdminEditOutlookPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<OutlookArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/articles/${articleId}`);
        if (res.status === 404) {
          setError('Artikel tidak ditemukan');
          return;
        }
        const json = await res.json();
        if (json.success) {
          setArticle(json.data.article);
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

  const handleSubmit = async (data: OutlookFormData, images: InlineImageEntry[]) => {
    setSubmitting(true);
    try {
      // 1. Upload all inline images and build blob→real URL mapping
      let finalContent = data.content_html;

      for (const image of images) {
        const formData = new FormData();
        formData.append('file', image.file);

        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadJson = await uploadRes.json();
        if (uploadJson.success && uploadJson.data?.media?.file_url) {
          finalContent = finalContent.split(image.blobUrl).join(uploadJson.data.media.file_url);
        }
      }

      // 2. Update the outlook article with final content (blob URLs replaced)
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          content_html: finalContent,
          category: 'outlook',
          status: data.status,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Gagal memperbarui artikel Outlook');
      }

      // 3. Redirect to outlook listing
      router.push('/admin/outlook');
    } catch (err) {
      setSubmitting(false);
      throw err; // Let OutlookEditor handle the error display
    }
  };

  if (loading) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <Link href="/admin/outlook" className={styles.backLink}>
            ← Kembali
          </Link>
          <h2>Edit Outlook</h2>
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
          <Link href="/admin/outlook" className={styles.backLink}>
            ← Kembali
          </Link>
          <h2>Edit Outlook</h2>
        </div>
        <div className={styles.editorCard}>
          <p style={{ color: 'var(--color-danger)' }}>{error || 'Artikel tidak ditemukan'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <Link href="/admin/outlook" className={styles.backLink}>
          ← Kembali
        </Link>
        <h2>Edit Outlook</h2>
      </div>
      <div className={styles.editorCard}>
        <OutlookEditor
          initialData={{
            title: article.title || '',
            content_html: article.content_html,
            status: article.status,
          }}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/admin/outlook')}
          submitLabel="Simpan Perubahan"
          submitting={submitting}
        />
      </div>
    </div>
  );
}
