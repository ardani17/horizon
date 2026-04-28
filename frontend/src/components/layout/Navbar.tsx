import Link from 'next/link';
import styles from './Navbar.module.css';
import { MobileMenu } from './MobileMenu';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Logo } from '../ui/Logo';

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
          <Logo variant="standard" height={28} />
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

        <div className={styles.navActions}>
          <Link href="/admin/login" className={styles.adminLink} title="Admin">
            Admin
          </Link>
          <ThemeToggle />
          <MobileMenu navItems={navItems.map((i) => ({ label: i.label, href: i.href }))} />
        </div>
      </nav>
    </header>
  );
}
