'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './layout.module.css';

interface AdminHeaderProps {
  username: string;
  onMenuToggle: () => void;
}

/**
 * Admin top bar with mobile menu toggle, admin user info, and logout button.
 */
export function AdminHeader({ username, onMenuToggle }: AdminHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      // Even on error, redirect to login
      router.push('/admin/login');
    }
  }

  return (
    <header className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        <span className={styles.pageTitle}>Admin Dashboard</span>
      </div>

      <div className={styles.topBarRight}>
        <div className={styles.adminInfo}>
          <span className={styles.adminName}>{username}</span>
          <span className={styles.adminRole}>Admin</span>
        </div>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Keluar...' : 'Logout'}
        </button>
      </div>
    </header>
  );
}
