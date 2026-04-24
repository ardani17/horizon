'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { UserProfile } from '@/components/admin/UserProfile';
import styles from '../users.module.css';

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

/**
 * Admin User Profile Detail Page
 *
 * Displays member profile with stats, article list, and credit transaction history.
 * Allows role change.
 *
 * Requirements: 7.2, 7.3, 16.6, 22.6, 22.7, 22.8
 */
export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`);
      const json = await res.json();
      if (json.success) {
        setUser(json.data.user);
        setStats(json.data.stats);
        setArticles(json.data.articles);
        setTransactions(json.data.transactions);
      } else {
        setError(json.error?.message || 'Gagal memuat profil pengguna');
      }
    } catch {
      setError('Gagal memuat profil pengguna');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleRoleChange = async (newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (json.success) {
        // Refresh profile data
        await fetchProfile();
      } else {
        alert(json.error?.message || 'Gagal mengubah role');
      }
    } catch {
      alert('Gagal mengubah role pengguna');
    }
  };

  if (loading) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <Link href="/admin/users" className={styles.backLink}>
            ← Kembali ke Daftar Pengguna
          </Link>
        </div>
        <p>Memuat profil pengguna...</p>
      </div>
    );
  }

  if (error || !user || !stats) {
    return (
      <div>
        <div className={styles.pageHeader}>
          <Link href="/admin/users" className={styles.backLink}>
            ← Kembali ke Daftar Pengguna
          </Link>
        </div>
        <div className="retro-box">
          <p>{error || 'Pengguna tidak ditemukan.'}</p>
          <button className="btn btn-secondary" onClick={() => router.push('/admin/users')}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <Link href="/admin/users" className={styles.backLink}>
          ← Kembali ke Daftar Pengguna
        </Link>
      </div>
      <h2>Profil Pengguna</h2>
      <UserProfile
        user={user}
        stats={stats}
        articles={articles}
        transactions={transactions}
        onRoleChange={handleRoleChange}
      />
    </div>
  );
}
