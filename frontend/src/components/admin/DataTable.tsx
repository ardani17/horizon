'use client';

import { ReactNode } from 'react';
import styles from './DataTable.module.css';

/**
 * Column definition for the DataTable.
 */
export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Column header label */
  label: string;
  /** Render function for the cell content */
  render: (row: T) => ReactNode;
  /** Optional: make column header sortable (future) */
  sortable?: boolean;
}

/**
 * Filter option for the DataTable toolbar.
 */
export interface FilterOption {
  label: string;
  value: string;
}

interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Row data */
  data: T[];
  /** Unique key extractor for each row */
  rowKey: (row: T) => string;
  /** Total number of items (for pagination info) */
  total: number;
  /** Current page (1-based) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Optional search value */
  searchValue?: string;
  /** Optional search change handler */
  onSearchChange?: (value: string) => void;
  /** Optional search placeholder */
  searchPlaceholder?: string;
  /** Optional filter options */
  filters?: {
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  /** Optional toolbar actions (e.g., "New Article" button) */
  toolbarActions?: ReactNode;
  /** Message when no data */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
}

/**
 * Reusable data table component for the admin dashboard.
 * Supports pagination, search, filters, and custom column rendering.
 *
 * Requirements: 5.1
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  total,
  page,
  pageSize,
  onPageChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Cari...',
  filters,
  toolbarActions,
  emptyMessage = 'Tidak ada data.',
  loading,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className={styles.tableContainer}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {onSearchChange && (
            <input
              type="search"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search"
            />
          )}
          {filters?.map((filter) => (
            <select
              key={filter.label}
              className={styles.filterSelect}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              aria-label={filter.label}
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        </div>
        {toolbarActions && <div>{toolbarActions}</div>}
      </div>

      {/* Table */}
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr className={styles.emptyRow}>
              <td colSpan={columns.length}>Memuat data...</td>
            </tr>
          ) : data.length === 0 ? (
            <tr className={styles.emptyRow}>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className={styles.pagination}>
        <span className={styles.paginationInfo}>
          {total === 0
            ? 'Tidak ada data'
            : `Menampilkan ${startItem}–${endItem} dari ${total}`}
        </span>
        <div className={styles.paginationButtons}>
          <button
            className={`btn btn-secondary ${styles.paginationBtn}`}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
          >
            ← Prev
          </button>
          <button
            className={`btn btn-secondary ${styles.paginationBtn}`}
            onClick={() => onPageChange(page + 1)}
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

/** Helper: render a status badge */
export function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    published: styles.badgePublished,
    hidden: styles.badgeHidden,
    draft: styles.badgeDraft,
  };

  return (
    <span className={`${styles.badge} ${classMap[status] ?? styles.badgeDraft}`}>
      {status}
    </span>
  );
}
