/**
 * Admin Login Layout
 *
 * Renders children without the main Navbar/Footer since the login
 * page has its own full-screen centered layout.
 */
export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
