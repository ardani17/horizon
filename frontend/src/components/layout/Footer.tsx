import styles from './Footer.module.css';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.logo}>Horizon</span>
            <p className={styles.tagline}>
              Komunitas trader — jurnal, cerita, dan analisa market.
            </p>
          </div>

          <div className={styles.links}>
            <div className={styles.linkGroup}>
              <h4 className={styles.linkGroupTitle}>Navigasi</h4>
              <ul className={styles.linkList} role="list">
                <li><a href="/" className={styles.link}>Feed</a></li>
                <li><a href="/outlook" className={styles.link}>Outlook</a></li>
                <li><a href="/gallery" className={styles.link}>Gallery</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            &copy; {currentYear} Horizon Trader Platform. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
