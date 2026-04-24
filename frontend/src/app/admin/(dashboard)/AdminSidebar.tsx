'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

/**
 * Navigation items for the admin sidebar.
 * Each section groups related links.
 */
const navSections = [
  {
    label: 'Utama',
    items: [
      { label: 'Dashboard', href: '/admin', icon: '📊' },
      { label: 'Articles', href: '/admin/articles', icon: '📝' },
      { label: 'Outlook', href: '/admin/outlook', icon: '📈' },
    ],
  },
  {
    label: 'Pengguna',
    items: [
      { label: 'Users', href: '/admin/users', icon: '👥' },
      { label: 'Credits', href: '/admin/credits', icon: '💰' },
      { label: 'Comments', href: '/admin/comments', icon: '💬' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { label: 'Logs', href: '/admin/logs', icon: '📋' },
      { label: 'API Keys', href: '/admin/api-keys', icon: '🔑' },
    ],
  },
] as const;

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Admin sidebar navigation with grouped links and active state.
 * On mobile, slides in as an overlay controlled by parent layout.
 */
export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  /**
   * Check if a nav link is active. Exact match for /admin (dashboard),
   * prefix match for other sections.
   */
  function isActive(href: string): boolean {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}
        aria-label="Admin navigation"
      >
        {/* Sidebar header */}
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.sidebarLogo} onClick={onClose}>
            Horizon <span className={styles.sidebarBadge}>Admin</span>
          </Link>
        </div>

        {/* Navigation sections */}
        <nav className={styles.sidebarNav}>
          {navSections.map((section) => (
            <div key={section.label} className={styles.navSection}>
              <div className={styles.navSectionLabel}>{section.label}</div>
              <ul className={styles.navList} role="list">
                {section.items.map((item) => (
                  <li key={item.href} className={styles.navItem}>
                    <Link
                      href={item.href}
                      className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
                      onClick={onClose}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                    >
                      <span className={styles.navIcon} aria-hidden="true">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.backToSite}>
            ← Kembali ke situs
          </Link>
        </div>
      </aside>
    </>
  );
}
