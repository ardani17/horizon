import Link from 'next/link';
import styles from './ErrorPage.module.css';

interface ErrorConfig {
  code: number;
  title: string;
  description: string;
  cause: string;
  action: string;
}

const ERROR_CONFIGS: Record<number, ErrorConfig> = {
  400: {
    code: 400,
    title: 'Permintaan Tidak Valid',
    description: 'Server tidak dapat memproses permintaan Anda.',
    cause: 'Format permintaan tidak sesuai atau data yang dikirim tidak lengkap.',
    action: 'Periksa kembali data yang Anda kirim dan coba lagi.',
  },
  401: {
    code: 401,
    title: 'Tidak Terautentikasi',
    description: 'Anda perlu login untuk mengakses halaman ini.',
    cause: 'Sesi Anda mungkin telah berakhir atau Anda belum login.',
    action: 'Silakan login kembali untuk melanjutkan.',
  },
  403: {
    code: 403,
    title: 'Akses Ditolak',
    description: 'Anda tidak memiliki izin untuk mengakses halaman ini.',
    cause: 'Akun Anda tidak memiliki hak akses yang diperlukan.',
    action: 'Hubungi administrator jika Anda merasa ini adalah kesalahan.',
  },
  404: {
    code: 404,
    title: 'Halaman Tidak Ditemukan',
    description: 'Halaman yang Anda cari tidak ada atau telah dipindahkan.',
    cause: 'URL mungkin salah ketik atau halaman telah dihapus.',
    action: 'Periksa kembali URL atau kembali ke halaman utama.',
  },
  500: {
    code: 500,
    title: 'Kesalahan Server',
    description: 'Terjadi kesalahan pada server kami.',
    cause: 'Server sedang mengalami masalah teknis.',
    action: 'Coba muat ulang halaman. Jika masalah berlanjut, coba lagi nanti.',
  },
};

interface ErrorPageProps {
  /** HTTP status code (400, 401, 403, 404, 500) */
  statusCode?: number;
  /** Optional custom title override */
  title?: string;
  /** Optional custom description override */
  description?: string;
  /** Whether to show the "Kembali ke Beranda" link */
  showHomeLink?: boolean;
  /** Optional retry handler */
  onRetry?: () => void;
}

/**
 * Reusable error page component for HTTP error codes.
 * Displays clear explanation, cause, and suggested action in Bahasa Indonesia.
 *
 * Requirements: 24.2
 */
export function ErrorPage({
  statusCode = 500,
  title,
  description,
  showHomeLink = true,
  onRetry,
}: ErrorPageProps) {
  const config = ERROR_CONFIGS[statusCode] || ERROR_CONFIGS[500];

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.codeBox}>
          <span className={styles.code}>{config.code}</span>
        </div>

        <h1 className={styles.title}>{title || config.title}</h1>
        <p className={styles.description}>{description || config.description}</p>

        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Penyebab:</span>
            <span className={styles.detailText}>{config.cause}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Saran:</span>
            <span className={styles.detailText}>{config.action}</span>
          </div>
        </div>

        <div className={styles.actions}>
          {onRetry && (
            <button onClick={onRetry} className="btn btn-primary" type="button">
              Coba Lagi
            </button>
          )}
          {showHomeLink && (
            <Link href="/" className={`btn btn-secondary ${styles.homeLink}`}>
              ← Kembali ke Beranda
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
