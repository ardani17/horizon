import { ErrorPage } from '@/components/ui/ErrorPage';

/**
 * Custom 404 Not Found page.
 * Displayed when a route is not matched by any page.
 *
 * Requirements: 24.2
 */
export default function NotFoundPage() {
  return <ErrorPage statusCode={404} />;
}
