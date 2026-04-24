// ============================================
// Horizon Trader Platform — Admin Auth Guard
// ============================================

import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

/**
 * Server Component wrapper that validates the admin session on every
 * admin page load. Redirects to /admin/login if the session is
 * invalid or expired.
 *
 * Usage:
 * ```tsx
 * export default async function AdminPage() {
 *   return (
 *     <AdminAuthGuard>
 *       <YourAdminContent />
 *     </AdminAuthGuard>
 *   );
 * }
 * ```
 */
export async function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const user = await validateSession();

  if (!user) {
    redirect('/admin/login');
  }

  return <>{children}</>;
}
