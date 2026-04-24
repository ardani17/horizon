'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, StatusBadge } from '@/components/admin';
import type { Column } from '@/components/admin';
import styles from './articles.module.css';

interface ArticleListItem {
  id: string;
  title: string | null;
  category: string;
  content_type: string;
  source: string;
  status: string;
  slug: string;
  author_username: string | null;
  media_count: number;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  trading: 'Trading',
  life_story: 'Life Story',
  general: 'General',
  outlook: 'Outlook',
};

const PAGE_SIZE = 20;

/**
 * Admin Articles List Page
 *
 * Displays all articles in a data table with search, status/category filters,
 * and actions for editing, toggling status, and deleting.
 *
 * Requirements: 5.1, 5.3, 5.4
 */
export default function AdminArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/articles?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setArticles(json.data.articles);
        setTotal(json.data.total);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  /** Toggle article status between published and hidden */
  const toggleStatus = async (article: ArticleListItem) => {
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

  /** Delete an article */
  const deleteArticle = async (article: ArticleListItem) => {
    if (!confirm(`Hapus artikel "${article.title || article.slug}"? Media terkait juga akan dihapus.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/articles/${article.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchArticles();
      }
    } catch {
      // Silently fail
    }
  };

  const columns: Column<ArticleListItem>[] = [
    {
      key: 'title',
      label: 'Judul',
      render: (row) => (
        <div className={styles.titleCell}>
          <Link href={`/admin/articles/${row.id}/edit`} className={styles.titleLink}>
            {row.title || <em className={styles.noTitle}>Tanpa judul</em>}
          </Link>
          <span className={styles.slug}>/{row.slug}</span>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Kategori',
      render: (row) => CATEGORY_LABELS[row.category] || row.category,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'source',
      label: 'Sumber',
      render: (row) => (
        <span className={styles.sourceTag}>
          {row.source === 'telegram' ? '🤖 Telegram' : '📝 Dashboard'}
        </span>
      ),
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
            onClick={() => router.push(`/admin/articles/${row.id}/edit`)}
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
      <h2>Manajemen Artikel</h2>
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
          {
            label: 'Kategori',
            value: categoryFilter,
            options: [
              { label: 'Semua Kategori', value: '' },
              { label: 'Trading', value: 'trading' },
              { label: 'Life Story', value: 'life_story' },
              { label: 'General', value: 'general' },
              { label: 'Outlook', value: 'outlook' },
            ],
            onChange: (val) => {
              setCategoryFilter(val);
              setPage(1);
            },
          },
        ]}
        toolbarActions={
          <Link href="/admin/articles/new" className="btn btn-primary">
            + Artikel Baru
          </Link>
        }
        emptyMessage="Belum ada artikel."
        loading={loading}
      />
    </div>
  );
}
