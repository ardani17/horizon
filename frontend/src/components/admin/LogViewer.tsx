'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './LogViewer.module.css';

interface LogEntry {
  id: string;
  actor_id: string | null;
  actor_type: string;
  actor_username: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface LogFilters {
  actions: string[];
  targetTypes: string[];
}

const PAGE_SIZE = 30;

/**
 * Activity Log Viewer with filters, search, and expandable detail view.
 *
 * Displays logs in reverse chronological order with filters for:
 * - Time range (from/to date)
 * - Actor (specific user)
 * - Action type
 * - Target type
 * - Keyword search across details and action fields
 *
 * Clicking a log entry expands it to show full JSONB details.
 *
 * Requirements: 23.3, 23.4, 23.5, 23.6
 */
export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [actorId, setActorId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Available filter options (fetched from API)
  const [filterOptions, setFilterOptions] = useState<LogFilters>({
    actions: [],
    targetTypes: [],
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      if (targetTypeFilter) params.set('target_type', targetTypeFilter);
      if (actorId) params.set('actor_id', actorId);
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        // Set to end of day
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        params.set('to', end.toISOString());
      }

      const res = await fetch(`/api/logs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs);
        setTotal(json.data.total);
        if (json.data.filters) {
          setFilterOptions(json.data.filters);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, targetTypeFilter, actorId, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getActorBadgeClass = (actorType: string): string => {
    switch (actorType) {
      case 'admin':
        return styles.actorAdmin;
      case 'member':
        return styles.actorMember;
      case 'system':
        return styles.actorSystem;
      case 'external_api':
        return styles.actorExternal;
      default:
        return styles.actorSystem;
    }
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatJson = (obj: Record<string, unknown> | null): string => {
    if (!obj) return '—';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <div className={styles.container}>
      {/* Filters toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="log-search">
            Pencarian
          </label>
          <input
            id="log-search"
            type="search"
            className={styles.searchInput}
            placeholder="Cari action atau detail..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="log-action">
            Action
          </label>
          <select
            id="log-action"
            className={styles.filterInput}
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua Action</option>
            {filterOptions.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="log-target-type">
            Target Type
          </label>
          <select
            id="log-target-type"
            className={styles.filterInput}
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua Target</option>
            {filterOptions.targetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="log-actor">
            Actor ID
          </label>
          <input
            id="log-actor"
            type="text"
            className={styles.filterInput}
            placeholder="UUID pengguna..."
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="log-from">
            Dari
          </label>
          <input
            id="log-from"
            type="date"
            className={styles.dateInput}
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="log-to">
            Sampai
          </label>
          <input
            id="log-to"
            type="date"
            className={styles.dateInput}
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className={styles.loadingState}>Memuat log...</div>
      ) : logs.length === 0 ? (
        <div className={styles.emptyState}>Tidak ada log ditemukan.</div>
      ) : (
        <ul className={styles.logList} role="list">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <li key={log.id} className={styles.logEntry}>
                <button
                  type="button"
                  className={styles.logSummary}
                  onClick={() => toggleExpand(log.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`log-detail-${log.id}`}
                >
                  <span
                    className={`${styles.logExpandIcon} ${isExpanded ? styles.logExpandIconOpen : ''}`}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  <span className={styles.logTime}>
                    {formatDate(log.created_at)}
                  </span>
                  <span className={styles.logAction}>{log.action}</span>
                  <span className={styles.logActor}>
                    {log.actor_username || log.actor_id?.slice(0, 8) || '—'}
                    <span
                      className={`${styles.actorBadge} ${getActorBadgeClass(log.actor_type)}`}
                    >
                      {log.actor_type}
                    </span>
                  </span>
                  <span className={styles.logTarget}>
                    {log.target_type
                      ? `${log.target_type}${log.target_id ? ` / ${log.target_id.slice(0, 8)}...` : ''}`
                      : '—'}
                  </span>
                </button>

                {isExpanded && (
                  <div
                    id={`log-detail-${log.id}`}
                    className={styles.logDetail}
                    role="region"
                    aria-label={`Detail log ${log.action}`}
                  >
                    <div className={styles.detailGrid}>
                      <span className={styles.detailLabel}>ID:</span>
                      <span className={styles.detailValue}>{log.id}</span>

                      <span className={styles.detailLabel}>Action:</span>
                      <span className={styles.detailValue}>{log.action}</span>

                      <span className={styles.detailLabel}>Actor:</span>
                      <span className={styles.detailValue}>
                        {log.actor_username
                          ? `${log.actor_username} (${log.actor_id})`
                          : log.actor_id || '—'}
                      </span>

                      <span className={styles.detailLabel}>Actor Type:</span>
                      <span className={styles.detailValue}>
                        {log.actor_type}
                      </span>

                      <span className={styles.detailLabel}>Target Type:</span>
                      <span className={styles.detailValue}>
                        {log.target_type || '—'}
                      </span>

                      <span className={styles.detailLabel}>Target ID:</span>
                      <span className={styles.detailValue}>
                        {log.target_id || '—'}
                      </span>

                      <span className={styles.detailLabel}>IP Address:</span>
                      <span className={styles.detailValue}>
                        {log.ip_address || '—'}
                      </span>

                      <span className={styles.detailLabel}>Timestamp:</span>
                      <span className={styles.detailValue}>
                        {log.created_at}
                      </span>
                    </div>

                    {log.details && (
                      <>
                        <div className={styles.detailJsonLabel}>
                          Details (JSONB):
                        </div>
                        <pre className={styles.detailJson}>
                          {formatJson(log.details)}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      <div className={styles.pagination}>
        <span className={styles.paginationInfo}>
          {total === 0
            ? 'Tidak ada log'
            : `Menampilkan ${startItem}–${endItem} dari ${total}`}
        </span>
        <div className={styles.paginationButtons}>
          <button
            className={`btn btn-secondary ${styles.paginationBtn}`}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
          >
            ← Prev
          </button>
          <button
            className={`btn btn-secondary ${styles.paginationBtn}`}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Halaman berikutnya"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
