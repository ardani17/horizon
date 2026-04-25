'use client';

import { useState, useEffect } from 'react';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  className?: string;
}

const STORAGE_KEY = 'horizon-theme';

/**
 * Theme toggle button that switches between dark and light modes.
 *
 * Renders a sun icon when dark mode is active (click to switch to light)
 * and a moon icon when light mode is active (click to switch to dark).
 *
 * Syncs with the DOM on mount to avoid SSR hydration mismatches.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null);

  // Sync with DOM on mount — read the current data-theme attribute
  // to avoid SSR mismatch (the inline init script sets it before hydration)
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    setTheme(newTheme);

    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // localStorage may be unavailable in private browsing
    }
  };

  // Don't render until we've synced with the DOM to avoid hydration mismatch
  if (theme === null) {
    return (
      <button
        className={`${styles.toggle} ${className ?? ''}`}
        aria-label="Toggle theme"
        type="button"
      >
        <span className={styles.iconPlaceholder} />
      </button>
    );
  }

  return (
    <button
      className={`${styles.toggle} ${className ?? ''}`}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      {theme === 'dark' ? (
        /* Sun icon — shown in dark mode, click to switch to light */
        <svg
          className={styles.icon}
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon — shown in light mode, click to switch to dark */
        <svg
          className={styles.icon}
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
