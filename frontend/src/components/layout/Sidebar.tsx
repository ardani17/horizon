import Link from 'next/link';
import styles from './Sidebar.module.css';

const categories = [
  { label: 'Semua', href: '/' },
  { label: 'Trading Room', href: '/?category=trading' },
  { label: 'Life & Coffee', href: '/?category=life_story' },
  { label: 'Outlook', href: '/outlook' },
  { label: 'Gallery', href: '/gallery' },
] as const;

export function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Sidebar navigasi">
      {/* Kategori */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Kategori</h3>
        <ul className={styles.categoryList} role="list">
          {categories.map((cat) => (
            <li key={cat.href + cat.label}>
              <Link href={cat.href} className={styles.categoryLink}>
                {cat.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Info Komunitas */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Komunitas</h3>
        <p className={styles.communityText}>
          Horizon adalah komunitas trader yang berbagi jurnal trading, cerita kehidupan, dan analisa market.
        </p>
        <div className={styles.communityStats}>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>📝</span>
            <span className={styles.statLabel}>Jurnal & Cerita</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>📊</span>
            <span className={styles.statLabel}>Analisa Market</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>💬</span>
            <span className={styles.statLabel}>Diskusi Aktif</span>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Links</h3>
        <ul className={styles.linkList} role="list">
          <li>
            <span className={styles.linkItem}>🔗 Telegram Group</span>
          </li>
          <li>
            <span className={styles.linkItem}>📖 Panduan</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}
