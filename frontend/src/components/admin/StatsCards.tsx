import styles from './StatsCards.module.css';

export interface StatsSummary {
  totalMembers: number;
  totalArticles: number;
  totalMedia: number;
  totalCredits: number;
}

interface StatsCardsProps {
  summary: StatsSummary;
}

const cards = [
  { key: 'totalMembers' as const, label: 'Total Members', icon: '👥' },
  { key: 'totalArticles' as const, label: 'Total Articles', icon: '📝' },
  { key: 'totalMedia' as const, label: 'Total Media', icon: '📷' },
  { key: 'totalCredits' as const, label: 'Circulating Credits', icon: '💰' },
];

/**
 * Summary stat cards for the admin dashboard.
 * Displays total members, articles, media, and circulating credits.
 *
 * Requirements: 22.1
 */
export function StatsCards({ summary }: StatsCardsProps) {
  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <div key={card.key} className={styles.card}>
          <div className={styles.cardIcon} aria-hidden="true">
            {card.icon}
          </div>
          <div className={styles.cardBody}>
            <span className={styles.cardValue}>
              {summary[card.key].toLocaleString()}
            </span>
            <span className={styles.cardLabel}>{card.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
