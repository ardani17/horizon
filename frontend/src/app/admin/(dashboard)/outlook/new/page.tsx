'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { OutlookFormData, InlineImageEntry } from '@/components/admin/OutlookEditor';

/** Dynamic import for OutlookEditor — heavy rich text editor loaded on demand */
const OutlookEditor = dynamic(
  () => import('@/components/admin/OutlookEditor').then((mod) => ({ default: mod.OutlookEditor })),
  { ssr: false }
);
import styles from '../../articles/articles.module.css';

/**
 * Admin New Outlook Article Page
 *
 * Upload form for Outlook (market analysis) articles with rich text editor,
 * inline image uploads, and preview. Articles are always created with
 * category "outlook" and source "dashboard".
 *
 * Requirements: 27.5, 27.6
 */
export default function AdminNewOutlookPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

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
          // Replace this specific blob URL with the real uploaded URL
          finalContent = finalContent.split(image.blobUrl).join(uploadJson.data.media.file_url);
        }
      }

      // 2. Create the outlook article with final content (blob URLs replaced)
      const res = await fetch('/api/articles', {
        method: 'POST',
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
        throw new Error(json.error?.message || 'Gagal membuat artikel Outlook');
      }

      // 3. Redirect to articles list
      router.push('/admin/articles');
    } catch (err) {
      setSubmitting(false);
      throw err; // Let OutlookEditor handle the error display
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <Link href="/admin/articles" className={styles.backLink}>
          ← Kembali
        </Link>
        <h2>Outlook Baru</h2>
      </div>
      <div className={styles.editorCard}>
        <OutlookEditor
          onSubmit={handleSubmit}
          onCancel={() => router.push('/admin/articles')}
          submitLabel="Publikasikan Outlook"
          submitting={submitting}
        />
      </div>
    </div>
  );
}
