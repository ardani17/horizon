import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui/Toast';
import { themeInitScript } from '@/lib/theme-init';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: 'Horizon Trader Platform',
    template: '%s | Horizon',
  },
  description:
    'Komunitas trader — jurnal trading, cerita kehidupan, dan analisa market.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  ),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'Horizon Trader Platform',
    title: 'Horizon Trader Platform',
    description:
      'Komunitas trader — jurnal trading, cerita kehidupan, dan analisa market.',
    images: [{ url: '/images/og-default.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Horizon Trader Platform',
    description:
      'Komunitas trader — jurnal trading, cerita kehidupan, dan analisa market.',
    images: ['/images/og-default.svg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable} data-theme="dark">
      <head>
        <link rel="icon" href="/images/logo/Logo-Horizon-Atom-Online-Black_7.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/images/logo/Logo-Horizon-Atom-Online-White_8.png" media="(prefers-color-scheme: dark)" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-to-content">
          Langsung ke konten
        </a>
        <ToastProvider>
          <Navbar />
          <div id="main-content">{children}</div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
