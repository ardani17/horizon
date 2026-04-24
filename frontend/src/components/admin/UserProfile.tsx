'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './UserProfile.module.css';

interface UserData {
  id: string;
  telegram_id: string | null;
  username: string | null;
  role: string;
  credit_balance: number;
  created_at: string;
}

interface UserStats {
  totalArticles: number;
  articlesByCategory: {
    trading: number;
    life_story: number;
    general: number;
    outlook: number;
  };
  avgArticlesPerMonth: number;
  lastPublishedAt: string | null;
}

interface ArticleItem {
  id: string;
  title: string | null;
  category: string;
  content_type: string;
  status: string;
  slug: string;
  media_count: number;
  created_at: string;
}

interface TransactionItem {
  id: string;
  amount: number;
  transaction_type: string;
  source_type: string;
  description: string | null;
  created_at: string;
}

interface UserProfileProps {
  user: UserData;
  stats: UserStats;
  articles: ArticleItem[];
  transactions: TransactionItem[];
  onRoleChange: (newRole: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  trading: 'Trading',
  life_story: 'Life Story',
  general: 'General',
  outlook: 'Outlook',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  article_trading: 'Artikel Trading',
  article_life_story: 'Artikel Life Story',
  article_general: 'Artikel General',
  manual_admin: 'Penyesuaian Admin',
  external_tool: 'Tool Eksternal',
};

/**
 * UserProfile component — displays member profile detail with stats,
 * article list, and credit transaction history.
 *
 * Requirements: 22.6, 22.7, 22.8, 7.2, 16.6
 */
export function UserProfile({ user, stats, articles, transactions, onRoleChange }: UserProfileProps) {
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const handleRoleChange = async () => {
    if (selectedRole === user.role) return;
    setSaving(true);
    try {
      await onRoleChange(selectedRole);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      {/* Profile header card */}
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <div className={styles.profileInfo}>
            <h3 className={styles.profileName}>
              {user.username || 'Tanpa Username'}
            </h3>
            <div className={styles.profileMeta}>
              {user.telegram_id && (
                <span className={styles.profileMetaItem}>
                  📱 TG: {user.telegram_id}
                </span>
              )}
              <span className={styles.profileMetaItem}>
                📅 Terdaftar: {formatDate(user.created_at)}
              </span>
              <span className={styles.profileMetaItem}>
                💰 Credit: <strong>{user.credit_balance}</strong>
              </span>
            </div>
          </div>

          {/* Role change */}
          <div className={styles.roleActions}>
            <select
              className={styles.roleSelect}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              aria-label="Ubah role"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={handleRoleChange}
              disabled={saving || selectedRole === user.role}
            >
              {saving ? 'Menyimpan...' : 'Ubah Role'}
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalArticles}</span>
            <span className={styles.statLabel}>Total Artikel</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{user.credit_balance}</span>
            <span className={styles.statLabel}>Saldo Credit</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.avgArticlesPerMonth}</span>
            <span className={styles.statLabel}>Rata-rata / Bulan</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.lastPublishedAt ? formatDate(stats.lastPublishedAt) : '—'}
            </span>
            <span className={styles.statLabel}>Artikel Terakhir</span>
          </div>
        </div>

        {/* Articles per category */}
        <h4 className={styles.sectionTitle}>Artikel per Kategori</h4>
        <div className={styles.categoryBreakdown}>
          {Object.entries(stats.articlesByCategory).map(([cat, count]) => (
            <div key={cat} className={styles.categoryItem}>
              <span className={styles.categoryCount}>{count}</span>
              <span className={styles.categoryLabel}>{CATEGORY_LABELS[cat] || cat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Articles and Transactions side by side */}
      <div className={styles.sectionsGrid}>
        {/* Article list */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Daftar Artikel</h4>
          <div className={styles.sectionScrollable}>
            {articles.length === 0 ? (
              <p className={styles.emptyState}>Belum ada artikel.</p>
            ) : (
              <ul className={styles.articleList}>
                {articles.map((article) => (
                  <li key={article.id} className={styles.articleItem}>
                    <div className={styles.articleItemInfo}>
                      <Link
                        href={`/admin/articles/${article.id}/edit`}
                        className={styles.articleItemTitle}
                      >
                        {article.title || `/${article.slug}`}
                      </Link>
                      <div className={styles.articleItemMeta}>
                        <span>{CATEGORY_LABELS[article.category] || article.category}</span>
                        <span>{formatDate(article.created_at)}</span>
                        {article.media_count > 0 && <span>📎 {article.media_count}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Credit transaction history */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Riwayat Transaksi Credit</h4>
          <div className={styles.sectionScrollable}>
            {transactions.length === 0 ? (
              <p className={styles.emptyState}>Belum ada transaksi.</p>
            ) : (
              <ul className={styles.transactionList}>
                {transactions.map((tx) => {
                  const isPositive = tx.transaction_type === 'earned' ||
                    (tx.transaction_type === 'adjusted' && tx.amount > 0);
                  const typeClass =
                    tx.transaction_type === 'earned'
                      ? styles.transactionEarned
                      : tx.transaction_type === 'spent'
                        ? styles.transactionSpent
                        : styles.transactionAdjusted;

                  return (
                    <li key={tx.id} className={styles.transactionItem}>
                      <div className={styles.transactionInfo}>
                        <span className={`${styles.transactionType} ${typeClass}`}>
                          {tx.transaction_type}
                        </span>
                        <span className={styles.transactionDesc}>
                          {tx.description || SOURCE_TYPE_LABELS[tx.source_type] || tx.source_type}
                        </span>
                      </div>
                      <div>
                        <span
                          className={`${styles.transactionAmount} ${isPositive ? styles.transactionAmountPositive : styles.transactionAmountNegative}`}
                        >
                          {isPositive ? '+' : ''}{tx.amount}
                        </span>
                        <div className={styles.transactionDate}>
                          {formatDateTime(tx.created_at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
