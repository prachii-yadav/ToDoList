import type { HistoryStatus } from '../types/task';

interface Props {
  history: HistoryStatus;
  loading: boolean;
  onUndo:  () => void;
  onRedo:  () => void;
}

/**
 * UndoRedoControls — Undo and Redo buttons.
 *
 * Buttons are disabled when there is nothing to undo/redo (driven by
 * the HistoryStatus returned by the backend's GET /tasks/history endpoint).
 * The count badges show how many undo/redo steps are available so the user
 * has context before clicking.
 */
export default function UndoRedoControls({ history, loading, onUndo, onRedo }: Props) {
  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.btn,
          ...((!history.canUndo || loading) ? styles.disabled : styles.undoColor),
        }}
        onClick={onUndo}
        disabled={!history.canUndo || loading}
        title={`Undo (${history.undoCount} step${history.undoCount !== 1 ? 's' : ''} available)`}
      >
        ↩ Undo
        {history.undoCount > 0 && (
          <span style={styles.badge}>{history.undoCount}</span>
        )}
      </button>

      <button
        style={{
          ...styles.btn,
          ...((!history.canRedo || loading) ? styles.disabled : styles.redoColor),
        }}
        onClick={onRedo}
        disabled={!history.canRedo || loading}
        title={`Redo (${history.redoCount} step${history.redoCount !== 1 ? 's' : ''} available)`}
      >
        ↪ Redo
        {history.redoCount > 0 && (
          <span style={styles.badge}>{history.redoCount}</span>
        )}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display:  'flex',
    gap:      8,
    alignItems: 'center',
  },
  btn: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '0.35rem 0.85rem',
    fontSize:     '0.875rem',
    border:       'none',
    borderRadius: 4,
    cursor:       'pointer',
    fontWeight:   500,
  },
  undoColor: {
    background: '#f59e0b',
    color:      '#fff',
  },
  redoColor: {
    background: '#8b5cf6',
    color:      '#fff',
  },
  disabled: {
    background: '#e5e7eb',
    color:      '#9ca3af',
    cursor:     'not-allowed',
  },
  badge: {
    background:   'rgba(255,255,255,0.3)',
    borderRadius: 999,
    padding:      '0 5px',
    fontSize:     '0.75rem',
    fontWeight:   700,
    minWidth:     18,
    textAlign:    'center',
  },
};
