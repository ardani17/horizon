'use client';

import { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import styles from './layout.module.css';

interface AdminShellProps {
  username: string;
  children: React.ReactNode;
}

/**
 * Client-side admin shell that manages sidebar open/close state
 * and renders the sidebar, header, and main content area.
 */
export function AdminShell({ username, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.adminLayout}>
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className={styles.mainArea}>
        <AdminHeader
          username={username}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />

        <main className={styles.content} id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
