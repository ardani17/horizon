'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataTable } from '@/components/admin';
import type { Column } from '@/components/admin';
import styles from './api-keys.module.css';

interface ApiKeyItem {
  id: string;
  key_prefix: string;
  app_name: string;
  created_by: string;
  creator_username: string | null;
  allowed_origins: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

/**
 * Admin API Key Management Page
 *
 * Lists all API keys with metadata, allows creating new keys
 * (displaying the raw key once), revoking keys, and configuring
 * allowed_origins per key.
 *
 * Requirements: 18.3
 */
export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Create form state
  const [appName, setAppName] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [creating, setCreating] = useState(false);

  // Raw key display (shown once after creation)
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys');
      const json = await res.json();
      if (json.success) {
        setKeys(json.data.keys);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  /** Create a new API key */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    setCreating(true);
    setRawKey(null);
    setCopied(false);

    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: appName.trim(),
          allowed_origins: allowedOrigins.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success && json.data.raw_key) {
        setRawKey(json.data.raw_key);
        setAppName('');
        setAllowedOrigins('');
        fetchKeys();
      }
    } catch {
      // Silently fail
    } finally {
      setCreating(false);
    }
  };

  /** Copy raw key to clipboard */
  const handleCopy = async () => {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  /** Revoke (deactivate) an API key */
  const handleRevoke = async (key: ApiKeyItem) => {
    if (!confirm(`Revoke API key "${key.app_name}" (${key.key_prefix}...)? Key ini tidak akan bisa digunakan lagi.`)) {
      return;
    }
    try {
      const res = await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key.id }),
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch {
      // Silently fail
    }
  };

  // Paginate client-side since we fetch all keys at once
  const total = keys.length;
  const paginatedKeys = keys.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<ApiKeyItem>[] = [
    {
      key: 'app_name',
      label: 'Aplikasi',
      render: (row) => <span className={styles.appName}>{row.app_name}</span>,
    },
    {
      key: 'key_prefix',
      label: 'Key Prefix',
      render: (row) => (
        <span className={styles.keyPrefix}>{row.key_prefix}...</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={row.is_active ? styles.badgeActive : styles.badgeRevoked}>
          {row.is_active ? 'Active' : 'Revoked'}
        </span>
      ),
    },
    {
      key: 'allowed_origins',
      label: 'Allowed Origins',
      render: (row) => (
        <span className={styles.origins} title={row.allowed_origins ?? ''}>
          {row.allowed_origins || '—'}
        </span>
      ),
    },
    {
      key: 'created_by',
      label: 'Dibuat Oleh',
      render: (row) => row.creator_username || '—',
    },
    {
      key: 'created_at',
      label: 'Dibuat',
      render: (row) =>
        new Date(row.created_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'last_used_at',
      label: 'Terakhir Digunakan',
      render: (row) =>
        row.last_used_at
          ? new Date(row.last_used_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (row) => (
        <div className={styles.actions}>
          {row.is_active && (
            <button
              className={`btn btn-secondary ${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => handleRevoke(row)}
              title="Revoke key"
            >
              🚫 Revoke
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2>Manajemen API Key</h2>

      {/* Create new API key form */}
      <div className={styles.createForm}>
        <h3 className={styles.createFormTitle}>Buat API Key Baru</h3>
        <form onSubmit={handleCreate}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="appName">Nama Aplikasi *</label>
              <input
                id="appName"
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Contoh: Signal Tool, Trading Bot"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="allowedOrigins">Allowed Origins (CORS)</label>
              <input
                id="allowedOrigins"
                type="text"
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                placeholder="Contoh: https://app.example.com, https://tool.example.com"
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating || !appName.trim()}
            >
              {creating ? 'Membuat...' : '+ Buat API Key'}
            </button>
          </div>
        </form>
      </div>

      {/* Raw key display — shown once after creation */}
      {rawKey && (
        <div className={styles.rawKeyBox} role="alert">
          <div className={styles.rawKeyWarning}>
            ⚠️ Simpan API key ini sekarang — tidak dapat ditampilkan lagi!
          </div>
          <div className={styles.rawKeyValue}>
            <span className={styles.rawKeyText}>{rawKey}</span>
            <button
              className={`btn btn-secondary ${styles.copyBtn}`}
              onClick={handleCopy}
              type="button"
            >
              {copied ? '✓ Disalin' : '📋 Salin'}
            </button>
          </div>
          <div className={styles.rawKeyNote}>
            Key ini di-hash sebelum disimpan. Anda tidak akan bisa melihatnya lagi setelah menutup pesan ini.
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setRawKey(null)}
            type="button"
            style={{ marginTop: 'var(--space-2)' }}
          >
            Tutup
          </button>
        </div>
      )}

      {/* API keys table */}
      <DataTable
        columns={columns}
        data={paginatedKeys}
        rowKey={(row) => row.id}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyMessage="Belum ada API key."
        loading={loading}
      />
    </div>
  );
}
