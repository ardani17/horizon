/**
 * Admin Root Layout
 *
 * Minimal wrapper for all /admin/* routes. Does NOT include the public
 * Navbar/Footer — admin has its own navigation provided by the
 * (dashboard) route group layout.
 *
 * The login page lives outside the (dashboard) group so it is
 * accessible without authentication.
 */
export const metadata = {
  title: {
    default: 'Admin | Horizon',
    template: '%s | Admin | Horizon',
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
