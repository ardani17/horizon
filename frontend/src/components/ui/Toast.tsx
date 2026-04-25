'use client';

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import styles from './Toast.module.css';

type ToastType = 'success' | 'error' | 'warning';

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Hook to access the toast notification function */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

/** Provider that renders toast notifications at the bottom of the viewport */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={styles.toastContainer} role="status" aria-live="polite">
          <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
