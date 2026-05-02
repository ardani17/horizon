'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ImportPanel.module.css';

interface ImportJob {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_fetched: number;
  total_imported: number;
  total_skipped: number;
  total_failed: number;
  error_message: string | null;
  triggered_by_username: string;
}

interface ImportPanelProps {
  onImportComplete?: () => void;
}

const POLL_INTERVAL = 2000;

/**
 * ImportPanel — WordPress Import Widget for Admin Blog Page
 *
 * Displays an import button, confirmation dialog, real-time progress,
 * and last import summary. All UI text in Indonesian.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */
export function ImportPanel({ onImportComplete }: ImportPanelProps) {
  const [latestJob, setLatestJob] = useState<ImportJob | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Stop any active polling interval */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /** Fetch the latest import job on mount */
  const fetchLatestJob = useCallback(async () => {
    try {
      const res = await fetch('/api/wordpress-import');
      const json = await res.json();
      if (json.success && json.data.jobs.length > 0) {
        const latest = json.data.jobs[0] as ImportJob;
        setLatestJob(latest);

        // If the latest job is still running, resume polling
        if (latest.status === 'running') {
          setActiveJob(latest);
          setIsImporting(true);
        }
      }
    } catch {
      // Silently fail — matches existing admin page pattern
    } finally {
      setLoading(false);
    }
  }, []);

  /** Poll a specific job by ID for progress updates */
  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/wordpress-import/${jobId}`);
        const json = await res.json();
        if (!json.success) return;

        const job = json.data.job as ImportJob;
        setActiveJob(job);

        if (job.status === 'completed') {
          stopPolling();
          setIsImporting(false);
          setLatestJob(job);
          setResultMessage({
            type: 'success',
            text: `Impor selesai — ${job.total_imported} diimpor, ${job.total_skipped} dilewati, ${job.total_failed} gagal.`,
          });
          onImportComplete?.();
        } else if (job.status === 'failed') {
          stopPolling();
          setIsImporting(false);
          setLatestJob(job);
          setResultMessage({
            type: 'error',
            text: job.error_message || 'Impor gagal karena kesalahan yang tidak diketahui.',
          });
        }
      } catch {
        // Network error during polling — keep trying
      }
    },
    [stopPolling, onImportComplete],
  );

  /** Start polling for a given job ID */
  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      // Poll immediately, then every POLL_INTERVAL
      pollJob(jobId);
      pollingRef.current = setInterval(() => pollJob(jobId), POLL_INTERVAL);
    },
    [stopPolling, pollJob],
  );

  /** Trigger a new import */
  const handleImport = async () => {
    setShowConfirm(false);
    setResultMessage(null);
    setIsImporting(true);

    try {
      const res = await fetch('/api/wordpress-import', { method: 'POST' });
      const json = await res.json();

      if (json.success && json.data.jobId) {
        const jobId = json.data.jobId as string;
        setActiveJob({
          id: jobId,
          status: 'running',
          started_at: new Date().toISOString(),
          completed_at: null,
          total_fetched: 0,
          total_imported: 0,
          total_skipped: 0,
          total_failed: 0,
          error_message: null,
          triggered_by_username: '',
        });
        startPolling(jobId);
      } else {
        // Handle error responses (e.g. 409 already running)
        const errorMsg = json.error?.message || 'Gagal memulai impor.';
        setIsImporting(false);
        setResultMessage({ type: 'error', text: errorMsg });
      }
    } catch {
      setIsImporting(false);
      setResultMessage({ type: 'error', text: 'Gagal menghubungi server.' });
    }
  };

  // Fetch latest job on mount
  useEffect(() => {
    fetchLatestJob();
  }, [fetchLatestJob]);

  // If we detected a running job on mount, start polling
  useEffect(() => {
    if (activeJob && activeJob.status === 'running' && !pollingRef.current) {
      startPolling(activeJob.id);
    }
  }, [activeJob, startPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  if (loading) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>📥 Impor WordPress</h3>
        <p className={styles.loading}>Memuat status impor...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>📥 Impor WordPress</h3>

      {/* Import button */}
      <button
        className={styles.importBtn}
        onClick={() => setShowConfirm(true)}
        disabled={isImporting}
      >
        {isImporting ? 'Mengimpor...' : 'Impor dari WordPress'}
      </button>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className={styles.overlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h4 className={styles.dialogTitle}>Konfirmasi Impor</h4>
            <p className={styles.dialogMessage}>
              Mulai impor artikel dari WordPress? Artikel dengan slug yang sudah ada akan dilewati.
            </p>
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={() => setShowConfirm(false)}>
                Batal
              </button>
              <button className={styles.confirmBtn} onClick={handleImport}>
                Mulai Impor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress display while importing */}
      {isImporting && activeJob && (
        <div className={styles.progressSection}>
          <p className={styles.progressTitle}>
            <span className={styles.spinner} />
            Sedang mengimpor...
          </p>
          <div className={styles.progressGrid}>
            <div className={styles.progressItem}>
              <span className={styles.progressCount}>{activeJob.total_fetched}</span>
              <span className={styles.progressLabel}>Diambil</span>
            </div>
            <div className={styles.progressItem}>
              <span className={styles.progressCount}>{activeJob.total_imported}</span>
              <span className={styles.progressLabel}>Diimpor</span>
            </div>
            <div className={styles.progressItem}>
              <span className={styles.progressCount}>{activeJob.total_skipped}</span>
              <span className={styles.progressLabel}>Dilewati</span>
            </div>
            <div className={styles.progressItem}>
              <span className={styles.progressCount}>{activeJob.total_failed}</span>
              <span className={styles.progressLabel}>Gagal</span>
            </div>
          </div>
        </div>
      )}

      {/* Result message (success or error) */}
      {resultMessage && (
        <div className={styles.resultSection}>
          <p className={resultMessage.type === 'success' ? styles.successMessage : styles.errorMessage}>
            {resultMessage.text}
          </p>
        </div>
      )}

      {/* Last import summary */}
      {latestJob && !isImporting && (
        <div className={styles.lastImport}>
          <p className={styles.lastImportTitle}>Impor Terakhir</p>
          <div className={styles.lastImportRow}>
            <span>
              <span className={styles.lastImportMeta}>Status: </span>
              {latestJob.status === 'completed' ? '✅ Selesai' : latestJob.status === 'failed' ? '❌ Gagal' : '⏳ Berjalan'}
            </span>
            <span>
              <span className={styles.lastImportMeta}>Waktu: </span>
              {new Date(latestJob.started_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>
              <span className={styles.lastImportMeta}>Hasil: </span>
              {latestJob.total_imported} diimpor, {latestJob.total_skipped} dilewati, {latestJob.total_failed} gagal
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
