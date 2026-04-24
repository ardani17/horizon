'use client';

import { ErrorPage } from '@/components/ui/ErrorPage';

/**
 * Custom error boundary page.
 * Displayed when an unhandled error occurs during rendering.
 *
 * Requirements: 24.2
 */
export default function ErrorBoundaryPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage statusCode={500} onRetry={reset} />;
}
