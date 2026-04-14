import type { Toast } from '../hooks/useToast';

interface Props {
  toasts:  Toast[];
  dismiss: (id: number) => void;
}

const TYPE_STYLES: Record<string, React.CSSProperties> = {
  success: { background: '#16a34a' },
  error:   { background: '#dc2626' },
  info:    { background: '#2563eb' },
};

const ICONS: Record<string, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
};

export default function ToastContainer({ toasts, dismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div style={styles.wrapper} aria-live="polite">
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{ ...styles.toast, ...TYPE_STYLES[toast.type] }}
          role="alert"
        >
          <span style={styles.icon}>{ICONS[toast.type]}</span>
          <span style={styles.message}>{toast.message}</span>
          <button
            style={styles.close}
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position:      'fixed',
    bottom:        24,
    right:         24,
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
    zIndex:        1000,
  },
  toast: {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    padding:      '0.65rem 1rem',
    borderRadius: 6,
    color:        '#fff',
    fontSize:     '0.9rem',
    fontWeight:   500,
    minWidth:     260,
    maxWidth:     380,
    boxShadow:    '0 4px 12px rgba(0,0,0,0.18)',
    animation:    'slideIn 0.2s ease',
  },
  icon: {
    fontWeight:  700,
    fontSize:    '1rem',
    flexShrink:  0,
  },
  message: {
    flex: 1,
  },
  close: {
    background:  'transparent',
    border:      'none',
    color:       'rgba(255,255,255,0.8)',
    cursor:      'pointer',
    fontSize:    '0.85rem',
    padding:     '0 2px',
    flexShrink:  0,
  },
};
