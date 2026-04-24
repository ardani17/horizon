'use client';

import dynamic from 'next/dynamic';

/** Dynamic import for Charts — heavy client component with chart rendering */
const Charts = dynamic(
  () => import('@/components/admin/Charts').then((mod) => ({ default: mod.Charts })),
  { ssr: false }
);

/** Dynamic import for BotStatus — client component that calls bot REST API */
const BotStatus = dynamic(
  () => import('@/components/admin/BotStatus').then((mod) => ({ default: mod.BotStatus })),
  { ssr: false }
);

/**
 * Client wrapper for dashboard widgets that require ssr: false.
 * In Next.js 16+, dynamic() with ssr: false must be used in Client Components.
 */
export function DashboardClientWidgets() {
  return (
    <>
      <BotStatus />
      <Charts />
    </>
  );
}
