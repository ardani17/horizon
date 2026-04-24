'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './Charts.module.css';

/* ---- Shared types for stats API response ---- */

interface ActivityPoint {
  label: string;
  count: number;
}

interface CategoryPoint {
  category: string;
  count: number;
}

interface ContributorByArticles {
  userId: string;
  username: string;
  articleCount: number;
}

interface ContributorByCredit {
  userId: string;
  username: string;
  creditBalance: number;
}

interface MemberActivity {
  active: number;
  inactive: number;
  total: number;
}

interface StatsData {
  activity: ActivityPoint[];
  categories: CategoryPoint[];
  topContributors: {
    byArticles: ContributorByArticles[];
    byCredit: ContributorByCredit[];
  };
  memberActivity: MemberActivity;
}

type TimeRange = 'day' | 'week' | 'month';

const CATEGORY_COLORS: Record<string, string> = {
  trading: 'var(--color-emerald)',
  life_story: 'var(--color-info)',
  general: 'var(--color-slate-muted)',
  outlook: 'var(--color-warning)',
};

const CATEGORY_LABELS: Record<string, string> = {
  trading: 'Trading',
  life_story: 'Life Story',
  general: 'General',
  outlook: 'Outlook',
};

/**
 * Admin dashboard charts — CSS-based bar charts for publication activity
 * and category distribution, plus top contributors and member activity.
 *
 * Requirements: 22.2, 22.3, 22.4, 22.5
 */
export function Charts() {
  const [range, setRange] = useState<TimeRange>('month');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async (timeRange: TimeRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?range=${timeRange}&period=12`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      // Silently fail — charts will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(range);
  }, [range, fetchStats]);

  function handleRangeChange(newRange: TimeRange) {
    setRange(newRange);
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <span>Memuat statistik...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.loading}>
        <span>Gagal memuat statistik.</span>
      </div>
    );
  }

  return (
    <div className={styles.chartsContainer}>
      {/* Publication Activity Chart */}
      <section className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Aktivitas Publikasi</h3>
          <div className={styles.rangeFilter} role="group" aria-label="Time range filter">
            {(['day', 'week', 'month'] as TimeRange[]).map((r) => (
              <button
                key={r}
                className={`${styles.rangeBtn} ${range === r ? styles.rangeBtnActive : ''}`}
                onClick={() => handleRangeChange(r)}
                aria-pressed={range === r}
              >
                {r === 'day' ? 'Harian' : r === 'week' ? 'Mingguan' : 'Bulanan'}
              </button>
            ))}
          </div>
        </div>
        <ActivityChart data={data.activity} />
      </section>

      {/* Category Distribution */}
      <section className={styles.chartSection}>
        <h3 className={styles.chartTitle}>Distribusi Kategori</h3>
        <CategoryChart data={data.categories} />
      </section>

      {/* Two-column: Top Contributors + Member Activity */}
      <div className={styles.twoCol}>
        <section className={styles.chartSection}>
          <h3 className={styles.chartTitle}>Top Kontributor</h3>
          <TopContributors data={data.topContributors} />
        </section>

        <section className={styles.chartSection}>
          <h3 className={styles.chartTitle}>Status Member</h3>
          <MemberActivityChart data={data.memberActivity} />
        </section>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function ActivityChart({ data }: { data: ActivityPoint[] }) {
  if (data.length === 0) {
    return <p className={styles.emptyState}>Belum ada data aktivitas.</p>;
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className={styles.barChart} role="img" aria-label="Publication activity bar chart">
      <div className={styles.barChartBars}>
        {data.map((point) => {
          const heightPct = (point.count / maxCount) * 100;
          return (
            <div key={point.label} className={styles.barCol}>
              <span className={styles.barValue}>{point.count}</span>
              <div
                className={styles.bar}
                style={{ height: `${heightPct}%` }}
                title={`${point.label}: ${point.count} artikel`}
              />
              <span className={styles.barLabel}>{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryChart({ data }: { data: CategoryPoint[] }) {
  if (data.length === 0) {
    return <p className={styles.emptyState}>Belum ada data kategori.</p>;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className={styles.categoryChart}>
      {/* Horizontal stacked bar */}
      <div
        className={styles.stackedBar}
        role="img"
        aria-label="Category distribution chart"
      >
        {data.map((cat) => {
          const pct = total > 0 ? (cat.count / total) * 100 : 0;
          return (
            <div
              key={cat.category}
              className={styles.stackedSegment}
              style={{
                width: `${pct}%`,
                backgroundColor: CATEGORY_COLORS[cat.category] || 'var(--color-slate-lighter)',
              }}
              title={`${CATEGORY_LABELS[cat.category] || cat.category}: ${cat.count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {data.map((cat) => {
          const pct = total > 0 ? (cat.count / total) * 100 : 0;
          return (
            <div key={cat.category} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{
                  backgroundColor: CATEGORY_COLORS[cat.category] || 'var(--color-slate-lighter)',
                }}
              />
              <span className={styles.legendLabel}>
                {CATEGORY_LABELS[cat.category] || cat.category}
              </span>
              <span className={styles.legendValue}>
                {cat.count} ({pct.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopContributors({
  data,
}: {
  data: StatsData['topContributors'];
}) {
  return (
    <div className={styles.contributorsContainer}>
      {/* By articles */}
      <div className={styles.contributorList}>
        <h4 className={styles.contributorSubtitle}>Artikel Terbanyak</h4>
        {data.byArticles.length === 0 ? (
          <p className={styles.emptyState}>Belum ada data.</p>
        ) : (
          <ol className={styles.rankList}>
            {data.byArticles.map((c, i) => (
              <li key={c.userId} className={styles.rankItem}>
                <span className={styles.rankNumber}>{i + 1}</span>
                <span className={styles.rankName}>{c.username || 'Unknown'}</span>
                <span className={styles.rankValue}>{c.articleCount} artikel</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* By credit */}
      <div className={styles.contributorList}>
        <h4 className={styles.contributorSubtitle}>Credit Tertinggi</h4>
        {data.byCredit.length === 0 ? (
          <p className={styles.emptyState}>Belum ada data.</p>
        ) : (
          <ol className={styles.rankList}>
            {data.byCredit.map((c, i) => (
              <li key={c.userId} className={styles.rankItem}>
                <span className={styles.rankNumber}>{i + 1}</span>
                <span className={styles.rankName}>{c.username || 'Unknown'}</span>
                <span className={styles.rankValue}>{c.creditBalance.toLocaleString()} cr</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function MemberActivityChart({ data }: { data: MemberActivity }) {
  const total = data.total || 1;
  const activePct = (data.active / total) * 100;
  const inactivePct = (data.inactive / total) * 100;

  return (
    <div className={styles.memberActivity}>
      {/* Horizontal stacked bar for active/inactive */}
      <div
        className={styles.stackedBar}
        role="img"
        aria-label="Active vs inactive members"
      >
        {data.active > 0 && (
          <div
            className={styles.stackedSegment}
            style={{
              width: `${activePct}%`,
              backgroundColor: 'var(--color-emerald)',
            }}
            title={`Aktif: ${data.active} (${activePct.toFixed(1)}%)`}
          />
        )}
        {data.inactive > 0 && (
          <div
            className={styles.stackedSegment}
            style={{
              width: `${inactivePct}%`,
              backgroundColor: 'var(--color-slate-muted)',
            }}
            title={`Tidak aktif: ${data.inactive} (${inactivePct.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* Stats */}
      <div className={styles.memberStats}>
        <div className={styles.memberStatItem}>
          <span
            className={styles.legendDot}
            style={{ backgroundColor: 'var(--color-emerald)' }}
          />
          <span>Aktif (30 hari)</span>
          <strong>{data.active}</strong>
        </div>
        <div className={styles.memberStatItem}>
          <span
            className={styles.legendDot}
            style={{ backgroundColor: 'var(--color-slate-muted)' }}
          />
          <span>Tidak Aktif</span>
          <strong>{data.inactive}</strong>
        </div>
        <div className={styles.memberStatItem}>
          <span className={styles.memberStatTotal}>Total: {data.total}</span>
        </div>
      </div>
    </div>
  );
}
