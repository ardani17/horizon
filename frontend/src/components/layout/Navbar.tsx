import Link from 'next/link';
import styles from './Navbar.module.css';
import { MobileMenu } from './MobileMenu';

const navItems = [
  { label: 'Feed', href: '/' },
  { label: 'Outlook', href: '/outlook' },
  { label: 'Gallery', href: '/gallery' },
] as const;

export function Navbar() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Navigasi utama">
        <Link href="/" className={styles.logo}>
          Horizon
        </Link>

        <ul className={styles.navList} role="list">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={styles.navLink}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <MobileMenu navItems={navItems.map((i) => ({ label: i.label, href: i.href }))} />
      </nav>
    </header>
  );
}
