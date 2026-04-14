import { useState } from 'react';
import type { Task } from '../types/task';

interface Props {
  task:       Task;
  mutating:   boolean;
  onComplete: (id: string) => void;
  onDelete:   (id: string) => void;
}

type PendingAction = 'complete' | 'delete' | null;

export default function TaskItem({ task, mutating, onComplete, onDelete }: Props) {
  const [pending, setPending] = useState<PendingAction>(null);

  const isCompleted = task.status === 'completed';
  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString()
    : null;

  function confirm() {
    if (pending === 'complete') onComplete(task.id);
    if (pending === 'delete')   onDelete(task.id);
    setPending(null);
  }

  const popupText = pending === 'complete'
    ? 'Mark this task as done?'
    : 'Delete this task?';

  return (
    <>
      <li style={{ ...styles.item, opacity: isCompleted ? 0.65 : 1 }}>
        {/* ── Left: text content ─────────────────────────────── */}
        <div style={styles.content}>
          <span style={{ ...styles.description, textDecoration: isCompleted ? 'line-through' : 'none' }}>
            {task.description}
          </span>
          <div style={styles.meta}>
            <Badge text={task.status}   color={isCompleted ? '#16a34a' : '#ca8a04'} />
            <Badge text={task.priority} color={PRIORITY_COLOR[task.priority]} />
            {task.tags.map(tag => (
              <Badge key={tag} text={`#${tag}`} color="#6366f1" />
            ))}
            {dueDateLabel && (
              <span style={styles.dueDate}>Due: {dueDateLabel}</span>
            )}
          </div>
        </div>

        {/* ── Right: icon buttons ────────────────────────────── */}
        <div style={styles.actions}>
          {!isCompleted && (
            <button
              style={{ ...styles.iconBtn, ...styles.tickBtn, opacity: mutating ? 0.5 : 1 }}
              onClick={() => setPending('complete')}
              disabled={mutating}
              title="Done"
              aria-label="Mark as done"
            >
              <TickIcon />
            </button>
          )}
          <button
            style={{ ...styles.iconBtn, ...styles.trashBtn, opacity: mutating ? 0.5 : 1 }}
            onClick={() => setPending('delete')}
            disabled={mutating}
            title="Delete"
            aria-label="Delete task"
          >
            <TrashIcon />
          </button>
        </div>
      </li>

      {/* ── Confirmation popup ──────────────────────────────── */}
      {pending && (
        <div style={styles.overlay} onClick={() => setPending(null)}>
          <div style={styles.popup} onClick={e => e.stopPropagation()}>
            <p style={styles.popupText}>{popupText}</p>
            <div style={styles.popupActions}>
              <button
                style={styles.popupCancel}
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.popupConfirm,
                  background: pending === 'delete' ? '#ef4444' : '#16a34a',
                }}
                onClick={confirm}
                autoFocus
              >
                {pending === 'delete' ? 'Delete' : 'Mark Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function TickIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ ...styles.badge, background: color }}>{text}</span>;
}

// ── Priority colours ──────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  low:    '#64748b',
  medium: '#f59e0b',
  high:   '#ef4444',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  item: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
    padding:        '0.75rem 1rem',
    borderBottom:   '1px solid #f0f0f0',
    listStyle:      'none',
  },
  content: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    flex:          1,
  },
  description: {
    fontSize:  '1rem',
    color:     '#111',
    wordBreak: 'break-word',
  },
  meta: {
    display:    'flex',
    flexWrap:   'wrap',
    gap:        4,
    alignItems: 'center',
  },
  badge: {
    color:         '#fff',
    fontSize:      '0.7rem',
    padding:       '2px 6px',
    borderRadius:  999,
    fontWeight:    600,
    textTransform: 'capitalize' as const,
  },
  dueDate: {
    fontSize: '0.75rem',
    color:    '#888',
  },
  actions: {
    display:    'flex',
    gap:        6,
    flexShrink: 0,
    alignItems: 'center',
  },
  // shared icon button base
  iconBtn: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          32,
    height:         32,
    border:         'none',
    borderRadius:   4,
    cursor:         'pointer',
    padding:        0,
    color:          '#fff',
  },
  tickBtn:  { background: '#16a34a' },
  trashBtn: { background: '#ef4444' },

  // ── Popup overlay ─────────────────────────────────────────────
  overlay: {
    position:        'fixed',
    inset:           0,
    background:      'rgba(0,0,0,0.35)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          999,
  },
  popup: {
    background:   '#fff',
    borderRadius: 10,
    padding:      '1.5rem 1.75rem',
    minWidth:     300,
    maxWidth:     400,
    boxShadow:    '0 8px 32px rgba(0,0,0,0.18)',
    display:      'flex',
    flexDirection: 'column',
    gap:          20,
  },
  popupText: {
    margin:     0,
    fontSize:   '1rem',
    color:      '#111',
    fontWeight: 500,
    lineHeight: 1.5,
    textAlign:  'center',
  },
  popupActions: {
    display:        'flex',
    gap:            10,
    justifyContent: 'center',
  },
  popupCancel: {
    padding:      '0.45rem 1rem',
    fontSize:     '0.9rem',
    background:   '#f3f4f6',
    color:        '#374151',
    border:       '1px solid #d1d5db',
    borderRadius: 6,
    cursor:       'pointer',
    fontWeight:   500,
  },
  popupConfirm: {
    padding:      '0.45rem 1rem',
    fontSize:     '0.9rem',
    color:        '#fff',
    border:       'none',
    borderRadius: 6,
    cursor:       'pointer',
    fontWeight:   600,
  },
};
