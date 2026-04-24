import { AdminAuthGuard } from '@/components/auth/AdminAuthGuard';
import { validateSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminShell } from './AdminShell';

/**
 * Admin Dashboard Layout
 *
 * Wraps all authenticated admin pages with:
 * 1. AdminAuthGuard — redirects to /admin/login if session is invalid
 * 2. AdminShell — sidebar navigation + top header bar
 *
 * The login page at /admin/login is NOT wrapped by this layout
 * because it lives outside the (dashboard) route group.
 *
 * Requirements: 5.5
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate session and get admin user info for the header
  const user = await validateSession();

  if (!user) {
    redirect('/admin/login');
  }

  return (
    <AdminAuthGuard>
      <AdminShell username={user.username ?? 'Admin'}>
        {children}
      </AdminShell>
    </AdminAuthGuard>
  );
}
