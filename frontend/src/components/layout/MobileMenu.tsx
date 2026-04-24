'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import styles from './MobileMenu.module.css';

interface NavItem {
  label: string;
  href: string;
}

const sidebarCategories = [
  { label: 'Semua', href: '/' },
  { label: 'Trading Room', href: '/?category=trading' },
  { label: 'Life & Coffee', href: '/?category=life_story' },
  { label: 'Outlook', href: '/outlook' },
  { label: 'Gallery', href: '/gallery' },
];

interface MobileMenuProps {
  navItems: NavItem[];
}

export function MobileMenu({ navItems }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  return (
    <>
      <button
        className={styles.hamburger}
        onClick={toggle}
        aria-label={isOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={isOpen}
        aria-controls="mobile-menu-overlay"
        type="button"
      >
        <span className={`${styles.hamburgerLine} ${isOpen ? styles.hamburgerLineOpen1 : ''}`} />
        <span className={`${styles.hamburgerLine} ${isOpen ? styles.hamburgerLineOpen2 : ''}`} />
        <span className={`${styles.hamburgerLine} ${isOpen ? styles.hamburgerLineOpen3 : ''}`} />
      </button>

      {isOpen && (
        <div
          className={styles.overlay}
          id="mobile-menu-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi mobile"
        >
          {/* Backdrop */}
          <div className={styles.backdrop} onClick={close} aria-hidden="true" />

          {/* Sidebar panel */}
          <nav className={styles.panel} aria-label="Menu mobile">
            <div className={styles.panelHeader}>
              <span className={styles.panelLogo}>Horizon</span>
              <button
                className={styles.closeButton}
                onClick={close}
                aria-label="Tutup menu"
                type="button"
              >
                ✕
              </button>
            </div>

            {/* Main nav links */}
            <div className={styles.panelSection}>
              <h3 className={styles.panelSectionTitle}>Navigasi</h3>
              <ul className={styles.panelList} role="list">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={styles.panelLink} onClick={close}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category links */}
            <div className={styles.panelSection}>
              <h3 className={styles.panelSectionTitle}>Kategori</h3>
              <ul className={styles.panelList} role="list">
                {sidebarCategories.map((cat) => (
                  <li key={cat.href + cat.label}>
                    <Link href={cat.href} className={styles.panelLink} onClick={close}>
                      {cat.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Community info */}
            <div className={styles.panelSection}>
              <h3 className={styles.panelSectionTitle}>Komunitas</h3>
              <p className={styles.panelText}>
                Horizon — komunitas trader berbagi jurnal, cerita, dan analisa market.
              </p>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
