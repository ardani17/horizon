'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DataTable, StatusBadge } from '@/components/admin';
import type { Column } from '@/components/admin';
import styles from './comments.module.css';

interface CommentListItem {
  id: string;
  article_id: string;
  article_title: string | null;
  article_slug: string;
  display_name: string;
  content: string;
  is_anonymous: boolean;
  status: string;
  created_at: string;
  user_id: string | null;
}

const PAGE_SIZE = 20;

/**
 * Admin Comment Moderation Page
 *
 * Lists all comments with article reference, author, status.
 * Supports hide/show toggle and delete actions.
 *
 * Requirements: 26.8
 */
export default function AdminCommentsPage() {
  const [comments, setComments] = useState<CommentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('admin', 'true');
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/comments?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setComments(json.data.comments);
        setTotal(json.data.total);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  /** Toggle comment status between visible and hidden */
  const toggleStatus = async (comment: CommentListItem) => {
    const newStatus = comment.status === 'visible' ? 'hidden' : 'visible';
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchComments();
      }
    } catch {
      // Silently fail
    }
  };

  /** Delete a comment permanently */
  const deleteComment = async (comment: CommentListItem) => {
    if (!confirm(`Hapus komentar dari "${comment.display_name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchComments();
      }
    } catch {
      // Silently fail
    }
  };

  const columns: Column<CommentListItem>[] = [
    {
      key: 'content',
      label: 'Komentar',
      render: (row) => (
        <div className={styles.commentContent} title={row.content}>
          {row.content}
        </div>
      ),
    },
    {
      key: 'article',
      label: 'Artikel',
      render: (row) => (
        <div className={styles.articleRef}>
          <Link
            href={`/admin/articles/${row.article_id}/edit`}
            className={styles.articleLink}
            title={row.article_title || row.article_slug}
          >
            {row.article_title || <em>Tanpa judul</em>}
          </Link>
          <span className={styles.articleSlug}>/{row.article_slug}</span>
        </div>
      ),
    },
    {
      key: 'author',
      label: 'Penulis',
      render: (row) => (
        <div className={styles.authorCell}>
          <span className={styles.authorName}>{row.display_name}</span>
          <span className={styles.authorTag}>
            {row.is_anonymous ? 'Anonim' : 'Member'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      label: 'Tanggal',
      render: (row) => new Date(row.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <div className={styles.actions}>
          <button
            className={`btn btn-secondary ${styles.actionBtn}`}
            onClick={() => toggleStatus(row)}
            title={row.status === 'visible' ? 'Sembunyikan' : 'Tampilkan'}
          >
            {row.status === 'visible' ? '👁️' : '🔓'}
          </button>
          <button
            className={`btn btn-secondary ${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => deleteComment(row)}
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
      <h2>Moderasi Komentar</h2>
      <DataTable
        columns={columns}
        data={comments}
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
        searchPlaceholder="Cari komentar atau nama penulis..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'Semua Status', value: '' },
              { label: 'Visible', value: 'visible' },
              { label: 'Hidden', value: 'hidden' },
            ],
            onChange: (val) => {
              setStatusFilter(val);
              setPage(1);
            },
          },
        ]}
        emptyMessage="Belum ada komentar."
        loading={loading}
      />
    </div>
  );
}
