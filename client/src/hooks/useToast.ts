import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id:      number;
  message: string;
  type:    ToastType;
}

interface UseToastReturn {
  toasts:    Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismiss:   (id: number) => void;
}

let nextId = 0;
const DURATION_MS = 3000;

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto-dismiss after DURATION_MS
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, DURATION_MS);
  }, []);

  return { toasts, showToast, dismiss };
}
