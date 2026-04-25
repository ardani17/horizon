'use client';

import { useState, useMemo } from 'react';
import { CategoryTabs, type CategoryFilter } from './CategoryTabs';
import { ArticleCard, type ArticleCardData } from './ArticleCard';
import { ArticleLongCard } from './ArticleLongCard';
import { Pagination } from '@/components/ui/Pagination';
import styles from './FeedList.module.css';

const ARTICLES_PER_PAGE = 10;

interface FeedListProps {
  articles: ArticleCardData[];
}

export function FeedList({ articles }: FeedListProps) {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    if (category === 'all') return articles;
    return articles.filter((a) => a.category === category);
  }, [articles, category]);

  const totalPages = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
  const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
  const paged = filtered.slice(startIndex, startIndex + ARTICLES_PER_PAGE);

  function handleCategoryChange(newCategory: CategoryFilter) {
    setCategory(newCategory);
    setCurrentPage(1);
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className={styles.feedList}>
      <CategoryTabs initialCategory={category} onCategoryChange={handleCategoryChange} />

      {paged.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>Belum ada artikel untuk kategori ini.</p>
        </div>
      ) : (
        <div className={styles.articles}>
          {paged.map((article) =>
            article.content_type === 'long' ? (
              <ArticleLongCard key={article.id} article={article} />
            ) : (
              <ArticleCard key={article.id} article={article} />
            )
          )}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
