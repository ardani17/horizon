'use client';

import { LogViewer } from '@/components/admin/LogViewer';

/**
 * Admin Activity Logs Page
 *
 * Displays all activity logs in reverse chronological order with
 * filters for time range, actor, action type, and target type.
 * Supports keyword search and expandable detail view for JSONB data.
 *
 * Requirements: 23.3, 23.4, 23.5, 23.6
 */
export default function AdminLogsPage() {
  return (
    <div>
      <h2>Activity Logs</h2>
      <LogViewer />
    </div>
  );
}
