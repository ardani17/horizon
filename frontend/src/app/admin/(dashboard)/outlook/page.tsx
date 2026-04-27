'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, StatusBadge } from '@/components/admin';
import type { Column } from '@/components/admin';
import styles from './outlook.module.css';

interface OutlookListItem {
  id: string;
  title: string | null;
  status: string;
  slug: string;
  author_username: string | null;
  media_count: number;
  created_at: string;
}

const PAGE_SIZE = 20;

/**
 * Admin Outlook Listing Page
 *
 * Displays outlook (market analysis) articles in a data table with search,
 * status filter, and actions for editing, toggling status, and deleting.
 * All API calls are scoped to category=outlook.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 3.1–3.5, 4.1–4.4, 5.1–5.3
 */
export default function AdminOutlookPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<OutlookListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('category', 'outlook');
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/articles?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setArticles(json.data.articles);
        setTotal(json.data.total);
      }
    } catch {
      // Silently fail — matches existing articles page pattern
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  /** Toggle article status: published → hidden, hidden/draft → published */
  const toggleStatus = async (article: OutlookListItem) => {
    const newStatus = article.status === 'published' ? 'hidden' : 'published';
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchArticles();
      }
    } catch {
      // Silently fail
    }
  };

  /** Delete an article after confirmation */
  const deleteArticle = async (article: OutlookListItem) => {
    if (!confirm(`Hapus artikel "${article.title || article.slug}"? Media terkait juga akan dihapus.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/articles/${article.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchArticles();
      } else {
        alert('Gagal menghapus artikel. Silakan coba lagi.');
      }
    } catch {
      alert('Gagal menghapus artikel. Silakan coba lagi.');
    }
  };

  const columns: Column<OutlookListItem>[] = [
    {
      key: 'title',
      label: 'Judul',
      render: (row) => (
        <div className={styles.titleCell}>
          <Link href={`/admin/outlook/${row.id}/edit`} className={styles.titleLink}>
            {row.title || <em className={styles.noTitle}>Tanpa judul</em>}
          </Link>
          <span className={styles.slug}>/{row.slug}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'author',
      label: 'Penulis',
      render: (row) => row.author_username || '—',
    },
    {
      key: 'media',
      label: 'Media',
      render: (row) => row.media_count > 0 ? `📎 ${row.media_count}` : '—',
    },
    {
      key: 'created_at',
      label: 'Tanggal',
      render: (row) => new Date(row.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <div className={styles.actions}>
          <button
            className={`btn btn-secondary ${styles.actionBtn}`}
            onClick={() => router.push(`/admin/outlook/${row.id}/edit`)}
            title="Edit"
          >
            ✏️
          </button>
          <button
            className={`btn btn-secondary ${styles.actionBtn}`}
            onClick={() => toggleStatus(row)}
            title={row.status === 'published' ? 'Sembunyikan' : 'Publikasikan'}
          >
            {row.status === 'published' ? '👁️' : '🔓'}
          </button>
          <button
            className={`btn btn-secondary ${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => deleteArticle(row)}
            title="Hapus"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Manajemen Outlook</h2>
      <DataTable
        columns={columns}
        data={articles}
        rowKey={(row) => row.id}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Cari judul atau konten..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'Semua Status', value: '' },
              { label: 'Published', value: 'published' },
              { label: 'Hidden', value: 'hidden' },
              { label: 'Draft', value: 'draft' },
            ],
            onChange: (val) => {
              setStatusFilter(val);
              setPage(1);
            },
          },
        ]}
        toolbarActions={
          <Link href="/admin/outlook/new" className="btn btn-primary">
            + Outlook Baru
          </Link>
        }
        emptyMessage="Belum ada artikel outlook."
        loading={loading}
      />
    </div>
  );
}
