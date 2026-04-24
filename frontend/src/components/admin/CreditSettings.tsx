'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './CreditSettings.module.css';

// ---- Types ----

interface CreditSettingItem {
  id: string;
  category: string;
  credit_reward: number;
  is_active: boolean;
  updated_at: string;
}

interface MemberOption {
  id: string;
  username: string | null;
  telegram_id: string | null;
  credit_balance: number;
}

interface TransactionItem {
  id: string;
  user_id: string;
  username: string | null;
  amount: number;
  transaction_type: string;
  source_type: string;
  description: string | null;
  created_at: string;
}

// ---- Constants ----

const CATEGORY_LABELS: Record<string, string> = {
  trading: 'Trading',
  life_story: 'Life Story',
  general: 'General',
};

const CATEGORY_ICONS: Record<string, string> = {
  trading: '📈',
  life_story: '☕',
  general: '💬',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  article_trading: 'Artikel Trading',
  article_life_story: 'Artikel Life Story',
  article_general: 'Artikel General',
  manual_admin: 'Penyesuaian Admin',
  external_tool: 'Tool Eksternal',
};

/**
 * CreditSettings component — Admin credit configuration form.
 *
 * Displays:
 * 1. Category reward settings (edit reward values, toggle active)
 * 2. Manual credit adjustment form (add/subtract for a member)
 * 3. Member credit transaction history
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
export function CreditSettings() {
  // Settings state
  const [settings, setSettings] = useState<CreditSettingItem[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, { credit_reward: number; is_active: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Manual adjustment state
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Transaction history state
  const [historyMemberId, setHistoryMemberId] = useState('');
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---- Fetch credit settings ----
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/credit/settings');
      const json = await res.json();
      if (json.success) {
        setSettings(json.data.settings);
        // Initialize edit values
        const values: Record<string, { credit_reward: number; is_active: boolean }> = {};
        for (const s of json.data.settings) {
          values[s.id] = { credit_reward: s.credit_reward, is_active: s.is_active };
        }
        setEditValues(values);
      }
    } catch {
      showToast('Gagal memuat pengaturan credit', 'error');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // ---- Fetch members for dropdown ----
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?pageSize=100');
      const json = await res.json();
      if (json.success) {
        setMembers(json.data.users.map((u: { id: string; username: string | null; telegram_id: string | null; credit_balance: number }) => ({
          id: u.id,
          username: u.username,
          telegram_id: u.telegram_id,
          credit_balance: u.credit_balance,
        })));
      }
    } catch {
      // Silently fail — members dropdown will be empty
    }
  }, []);

  // ---- Fetch transaction history for a member ----
  const fetchTransactions = useCallback(async (memberId: string) => {
    if (!memberId) {
      setTransactions([]);
      return;
    }
    setTransactionsLoading(true);
    try {
      const res = await fetch(`/api/users/${memberId}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(
          json.data.transactions.map((t: TransactionItem) => ({
            ...t,
            username: json.data.user.username,
          })),
        );
      }
    } catch {
      showToast('Gagal memuat riwayat transaksi', 'error');
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchMembers();
  }, [fetchSettings, fetchMembers]);

  // ---- Save a single category setting ----
  const saveSetting = async (settingId: string) => {
    const values = editValues[settingId];
    if (!values) return;

    setSavingId(settingId);
    try {
      const res = await fetch('/api/credit/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: settingId,
          credit_reward: values.credit_reward,
          is_active: values.is_active,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Pengaturan berhasil disimpan', 'success');
        fetchSettings();
      } else {
        showToast(json.error?.message || 'Gagal menyimpan', 'error');
      }
    } catch {
      showToast('Gagal menyimpan pengaturan', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ---- Submit manual adjustment ----
  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseInt(adjustAmount, 10);
    if (!selectedMemberId || isNaN(amount) || amount === 0 || !adjustDescription.trim()) {
      showToast('Lengkapi semua field', 'error');
      return;
    }

    setAdjusting(true);
    try {
      const res = await fetch('/api/credit/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedMemberId,
          amount,
          description: adjustDescription.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Credit berhasil ${amount > 0 ? 'ditambahkan' : 'dikurangi'}`, 'success');
        setAdjustAmount('');
        setAdjustDescription('');
        setSelectedMemberId('');
        fetchMembers(); // Refresh balances
        // Refresh transaction history if viewing the same member
        if (historyMemberId === selectedMemberId) {
          fetchTransactions(historyMemberId);
        }
      } else {
        showToast(json.error?.message || 'Gagal melakukan penyesuaian', 'error');
      }
    } catch {
      showToast('Gagal melakukan penyesuaian credit', 'error');
    } finally {
      setAdjusting(false);
    }
  };

  // ---- Handle history member change ----
  const handleHistoryMemberChange = (memberId: string) => {
    setHistoryMemberId(memberId);
    fetchTransactions(memberId);
  };

  // ---- Helpers ----
  const hasChanges = (settingId: string) => {
    const original = settings.find((s) => s.id === settingId);
    const edited = editValues[settingId];
    if (!original || !edited) return false;
    return original.credit_reward !== edited.credit_reward || original.is_active !== edited.is_active;
  };

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
      {/* 1. Category Reward Settings */}
      <div className={styles.settingsCard}>
        <h4 className={styles.sectionTitle}>Pengaturan Reward per Kategori</h4>
        {settingsLoading ? (
          <p className={styles.emptyState}>Memuat pengaturan...</p>
        ) : (
          <div className={styles.categoryGrid}>
            {settings.map((setting) => {
              const edited = editValues[setting.id];
              if (!edited) return null;
              return (
                <div
                  key={setting.id}
                  className={`${styles.categoryCard} ${!edited.is_active ? styles.categoryCardInactive : ''}`}
                >
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>
                      {CATEGORY_ICONS[setting.category] || '📦'}{' '}
                      {CATEGORY_LABELS[setting.category] || setting.category}
                    </span>
                    <label className={styles.toggleLabel}>
                      <input
                        type="checkbox"
                        className={styles.toggleCheckbox}
                        checked={edited.is_active}
                        onChange={(e) =>
                          setEditValues((prev) => ({
                            ...prev,
                            [setting.id]: { ...prev[setting.id], is_active: e.target.checked },
                          }))
                        }
                        aria-label={`Aktifkan reward ${CATEGORY_LABELS[setting.category] || setting.category}`}
                      />
                      Aktif
                    </label>
                  </div>

                  <div className={styles.rewardField}>
                    <span className={styles.rewardLabel}>Reward:</span>
                    <input
                      type="number"
                      className={styles.rewardInput}
                      min={0}
                      value={edited.credit_reward}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [setting.id]: {
                            ...prev[setting.id],
                            credit_reward: Math.max(0, parseInt(e.target.value, 10) || 0),
                          },
                        }))
                      }
                      aria-label={`Credit reward untuk ${CATEGORY_LABELS[setting.category] || setting.category}`}
                    />
                    <span className={styles.rewardUnit}>credit</span>
                  </div>

                  <div className={styles.updatedAt}>
                    Terakhir diubah: {formatDateTime(setting.updated_at)}
                  </div>

                  <div className={styles.categoryActions}>
                    <button
                      className={`btn btn-primary ${styles.saveBtn}`}
                      onClick={() => saveSetting(setting.id)}
                      disabled={!hasChanges(setting.id) || savingId === setting.id}
                    >
                      {savingId === setting.id ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Manual Credit Adjustment */}
      <div className={styles.adjustCard}>
        <h4 className={styles.sectionTitle}>Penyesuaian Credit Manual</h4>
        <form className={styles.adjustForm} onSubmit={submitAdjustment}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="adjust-member">
              Member
            </label>
            <select
              id="adjust-member"
              className={styles.formSelect}
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              required
            >
              <option value="">— Pilih member —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username || `TG:${m.telegram_id}`} (💰 {m.credit_balance})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="adjust-amount">
              Jumlah (positif = tambah, negatif = kurangi)
            </label>
            <input
              id="adjust-amount"
              type="number"
              className={styles.formInput}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="contoh: 10 atau -5"
              required
            />
          </div>

          <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.formLabel} htmlFor="adjust-description">
              Deskripsi / Alasan
            </label>
            <textarea
              id="adjust-description"
              className={styles.formTextarea}
              value={adjustDescription}
              onChange={(e) => setAdjustDescription(e.target.value)}
              placeholder="Alasan penyesuaian credit..."
              required
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={adjusting || !selectedMemberId || !adjustAmount || !adjustDescription.trim()}
            >
              {adjusting ? 'Memproses...' : 'Sesuaikan Credit'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Transaction History */}
      <div className={styles.historyCard}>
        <div className={styles.historyHeader}>
          <h4 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
            Riwayat Transaksi Credit
          </h4>
          <div className={styles.historyFilter}>
            <select
              className={styles.historyFilterSelect}
              value={historyMemberId}
              onChange={(e) => handleHistoryMemberChange(e.target.value)}
              aria-label="Pilih member untuk melihat riwayat"
            >
              <option value="">— Pilih member —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username || `TG:${m.telegram_id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!historyMemberId ? (
          <p className={styles.emptyState}>Pilih member untuk melihat riwayat transaksi.</p>
        ) : transactionsLoading ? (
          <p className={styles.emptyState}>Memuat riwayat...</p>
        ) : transactions.length === 0 ? (
          <p className={styles.emptyState}>Belum ada transaksi untuk member ini.</p>
        ) : (
          <ul className={styles.transactionList}>
            {transactions.map((tx) => {
              const isPositive =
                tx.transaction_type === 'earned' ||
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
                  <div className={styles.transactionRight}>
                    <span
                      className={`${styles.transactionAmount} ${isPositive ? styles.transactionAmountPositive : styles.transactionAmountNegative}`}
                    >
                      {isPositive ? '+' : ''}
                      {tx.amount}
                    </span>
                    <div className={styles.transactionDate}>{formatDateTime(tx.created_at)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
