'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/admin';
import type { Column } from '@/components/admin';
import styles from './users.module.css';

interface UserListItem {
  id: string;
  telegram_id: string | null;
  username: string | null;
  role: string;
  credit_balance: number;
  article_count: number;
  created_at: string;
}

const PAGE_SIZE = 20;

/**
 * Admin Users List Page
 *
 * Displays all users in a data table with search, role filter,
 * and link to user profile detail.
 *
 * Requirements: 7.1, 22.6
 */
export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data.users);
        setTotal(json.data.total);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns: Column<UserListItem>[] = [
    {
      key: 'username',
      label: 'Pengguna',
      render: (row) => (
        <div className={styles.userCell}>
          <Link href={`/admin/users/${row.id}`} className={styles.usernameLink}>
            {row.username || <span className={styles.noUsername}>Tanpa username</span>}
          </Link>
          {row.telegram_id && (
            <span className={styles.telegramId}>TG: {row.telegram_id}</span>
          )}
        </div>
      ),
    },
    {
      key: 'telegram_id',
      label: 'Telegram ID',
      render: (row) => (
        <span className={styles.telegramId}>
          {row.telegram_id || '—'}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <span className={`${styles.roleBadge} ${row.role === 'admin' ? styles.roleAdmin : styles.roleMember}`}>
          {row.role}
        </span>
      ),
    },
    {
      key: 'credit_balance',
      label: 'Credit',
      render: (row) => (
        <span className={styles.creditBadge}>{row.credit_balance}</span>
      ),
    },
    {
      key: 'article_count',
      label: 'Artikel',
      render: (row) => String(row.article_count),
    },
    {
      key: 'created_at',
      label: 'Terdaftar',
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
            onClick={() => router.push(`/admin/users/${row.id}`)}
            title="Lihat Profil"
          >
            👤
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Manajemen Pengguna</h2>
      <DataTable
        columns={columns}
        data={users}
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
        searchPlaceholder="Cari username atau Telegram ID..."
        filters={[
          {
            label: 'Role',
            value: roleFilter,
            options: [
              { label: 'Semua Role', value: '' },
              { label: 'Admin', value: 'admin' },
              { label: 'Member', value: 'member' },
            ],
            onChange: (val) => {
              setRoleFilter(val);
              setPage(1);
            },
          },
        ]}
        emptyMessage="Belum ada pengguna terdaftar."
        loading={loading}
      />
    </div>
  );
}
