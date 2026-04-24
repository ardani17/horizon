'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ArticleFormData } from '@/components/admin';

/** Dynamic import for ArticleEditor — heavy rich text editor loaded on demand */
const ArticleEditor = dynamic(
  () => import('@/components/admin/ArticleEditor').then((mod) => ({ default: mod.ArticleEditor })),
  { ssr: false }
);
import styles from '../articles.module.css';

/**
 * Admin New Article Page
 *
 * Upload form with content, category selector, and media attachment.
 * Creates article with source "dashboard".
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export default function AdminNewArticlePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: ArticleFormData, newFiles: File[]) => {
    setSubmitting(true);
    try {
      // 1. Create the article
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Gagal membuat artikel');
      }

      const articleId = json.data.article.id;

      // 2. Upload media files if any
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
      throw err; // Let ArticleEditor handle the error display
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <Link href="/admin/articles" className={styles.backLink}>
          ← Kembali
        </Link>
        <h2>Artikel Baru</h2>
      </div>
      <div className={styles.editorCard}>
        <ArticleEditor
          onSubmit={handleSubmit}
          onCancel={() => router.push('/admin/articles')}
          submitLabel="Publikasikan"
          submitting={submitting}
        />
      </div>
    </div>
  );
}
