'use client';

import { useState } from 'react';
import styles from './CategoryTabs.module.css';

export type CategoryFilter = 'all' | 'trading' | 'life_story';

interface CategoryTabsProps {
  initialCategory?: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
}

const tabs: { label: string; value: CategoryFilter }[] = [
  { label: 'Semua', value: 'all' },
  { label: 'Trading Room', value: 'trading' },
  { label: 'Life & Coffee', value: 'life_story' },
];

export function CategoryTabs({ initialCategory = 'all', onCategoryChange }: CategoryTabsProps) {
  const [active, setActive] = useState<CategoryFilter>(initialCategory);

  function handleClick(value: CategoryFilter) {
    setActive(value);
    onCategoryChange(value);
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Filter kategori artikel">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          className={`${styles.tab} ${active === tab.value ? styles.tabActive : ''}`}
          onClick={() => handleClick(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
