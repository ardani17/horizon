'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './BotStatus.module.css';

interface BotStatusData {
  status: string;
  uptime: number;
  startedAt: string;
  timestamp: string;
  botTokenConfigured: boolean;
}

interface CommandUsageData {
  commandUsage: Record<string, number>;
  totalInvocations: number;
}

/**
 * Bot Status widget for the admin dashboard.
 *
 * Displays bot health status and command usage statistics by calling
 * the bot's REST API endpoints via the internal Docker network
 * (proxied through Nginx at /api/bot/*).
 *
 * Requirements: 15.4, 15.5
 */
export function BotStatus() {
  const [botStatus, setBotStatus] = useState<BotStatusData | null>(null);
  const [commandStats, setCommandStats] = useState<CommandUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchBotData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, statsRes] = await Promise.all([
        fetch('/api/bot/status'),
        fetch('/api/bot/stats'),
      ]);

      if (!statusRes.ok || !statsRes.ok) {
        throw new Error('Bot service tidak dapat dihubungi');
      }

      const statusJson = await statusRes.json();
      const statsJson = await statsRes.json();

      if (statusJson.success) {
        setBotStatus(statusJson.data);
      }
      if (statsJson.success) {
        setCommandStats(statsJson.data);
      }
    } catch {
      setError('Gagal menghubungi bot service. Pastikan bot sedang berjalan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBotData();
  }, [fetchBotData]);

  const handleSendNotification = async () => {
    if (!notifyMessage.trim()) return;

    setNotifySending(true);
    setNotifyResult(null);
    try {
      const res = await fetch('/api/bot/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: notifyMessage.trim() }),
      });

      const json = await res.json();
      if (json.success) {
        setNotifyResult({ success: true, message: 'Notifikasi berhasil dikirim ke grup.' });
        setNotifyMessage('');
      } else {
        setNotifyResult({ success: false, message: json.error?.message || 'Gagal mengirim notifikasi.' });
      }
    } catch {
      setNotifyResult({ success: false, message: 'Gagal menghubungi bot service.' });
    } finally {
      setNotifySending(false);
    }
  };

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}h ${hours}j ${mins}m`;
    if (hours > 0) return `${hours}j ${mins}m`;
    return `${mins}m`;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>🤖 Telegram Bot</h3>
        <p className={styles.loading}>Memuat status bot...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>🤖 Telegram Bot</h3>
        <div className={styles.errorState}>
          <span className={styles.statusDot} data-status="offline" />
          <span>{error}</span>
        </div>
        <button className={styles.retryBtn} onClick={fetchBotData}>
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>🤖 Telegram Bot</h3>

      {/* Status row */}
      {botStatus && (
        <div className={styles.statusRow}>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} data-status={botStatus.status === 'running' ? 'online' : 'offline'} />
            <span className={styles.statusLabel}>
              {botStatus.status === 'running' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusMeta}>Uptime:</span>
            <span className={styles.statusValue}>{formatUptime(botStatus.uptime)}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusMeta}>Token:</span>
            <span className={styles.statusValue}>
              {botStatus.botTokenConfigured ? '✅ Configured' : '❌ Missing'}
            </span>
          </div>
        </div>
      )}

      {/* Command stats */}
      {commandStats && (
        <div className={styles.statsSection}>
          <div className={styles.statsHeader}>
            <span className={styles.statsLabel}>Command Usage</span>
            <span className={styles.statsTotal}>
              Total: {commandStats.totalInvocations}
            </span>
          </div>
          {Object.keys(commandStats.commandUsage).length > 0 ? (
            <div className={styles.statsList}>
              {Object.entries(commandStats.commandUsage).map(([cmd, count]) => (
                <div key={cmd} className={styles.statsItem}>
                  <code className={styles.cmdName}>{cmd}</code>
                  <span className={styles.cmdCount}>{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyStats}>Belum ada command yang digunakan.</p>
          )}
        </div>
      )}

      {/* Send notification */}
      <div className={styles.notifySection}>
        <label className={styles.notifyLabel} htmlFor="bot-notify-message">
          Kirim Notifikasi ke Grup
        </label>
        <div className={styles.notifyForm}>
          <input
            id="bot-notify-message"
            type="text"
            className={styles.notifyInput}
            placeholder="Tulis pesan notifikasi..."
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !notifySending) handleSendNotification();
            }}
            disabled={notifySending}
          />
          <button
            className={styles.notifyBtn}
            onClick={handleSendNotification}
            disabled={notifySending || !notifyMessage.trim()}
          >
            {notifySending ? 'Mengirim...' : 'Kirim'}
          </button>
        </div>
        {notifyResult && (
          <p className={notifyResult.success ? styles.notifySuccess : styles.notifyError}>
            {notifyResult.message}
          </p>
        )}
      </div>
    </div>
  );
}
