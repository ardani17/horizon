'use client';

import { CreditSettings } from '@/components/admin/CreditSettings';

/**
 * Admin Credit Settings Page
 *
 * Displays credit reward configuration per category,
 * manual credit adjustment form, and transaction history.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
export default function AdminCreditsPage() {
  return (
    <div>
      <h2>Pengaturan Credit</h2>
      <CreditSettings />
    </div>
  );
}
