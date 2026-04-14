import type { TaskFilter, TaskStatus, TaskPriority } from '../types/task';

interface Props {
  filter:   TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

/**
 * FilterControls — status tabs, priority dropdown, and keyword search.
 *
 * Calls props.onChange with the merged filter object whenever any control
 * changes. The parent (useTasks hook) re-fetches tasks automatically.
 * This component holds no state — it is purely controlled.
 */
export default function FilterControls({ filter, onChange }: Props) {
  function set(partial: Partial<TaskFilter>) {
    onChange({ ...filter, ...partial, page: 1 }); // reset to page 1 on any filter change
  }

  return (
    <div style={styles.container}>
      {/* ── Status tabs ─────────────────────────────────────────── */}
      <div style={styles.tabs}>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={String(opt.value)}
            style={{
              ...styles.tab,
              ...(filter.status === opt.value ? styles.tabActive : {}),
            }}
            onClick={() => set({ status: opt.value as TaskStatus | undefined })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <span style={styles.divider} />

      {/* ── Priority filter ──────────────────────────────────────── */}
      <select
        style={styles.select}
        value={filter.priority ?? ''}
        aria-label="Filter by priority"
        onChange={e => set({ priority: (e.target.value || undefined) as TaskPriority | undefined })}
      >
        <option value="">Priority: All</option>
        <option value="low">Priority: Low</option>
        <option value="medium">Priority: Medium</option>
        <option value="high">Priority: High</option>
      </select>

      {/* ── Keyword search ───────────────────────────────────────── */}
      <input
        style={styles.searchInput}
        type="search"
        placeholder="Search"
        aria-label="Search tasks"
        value={filter.search ?? ''}
        onChange={e => set({ search: e.target.value || undefined })}
      />
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: 'All',       value: undefined   },
  { label: 'Pending',   value: 'pending'   },
  { label: 'Completed', value: 'completed' },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display:      'flex',
    alignItems:   'center',  // vertically centre everything on one line
    gap:          8,
    flexWrap:     'nowrap',  // never wrap onto a second line
    marginBottom: '1rem',
  },
  tabs: {
    display:    'flex',
    gap:        4,
    flexShrink: 0,           // tabs never shrink
  },
  tab: {
    padding:      '0.35rem 0.85rem',
    fontSize:     '0.875rem',
    border:       '1px solid #d1d5db',
    borderRadius: 4,
    background:   '#fff',
    cursor:       'pointer',
    color:        '#374151',
    whiteSpace:   'nowrap',
  },
  tabActive: {
    background: '#2563eb',
    color:      '#fff',
    border:     '1px solid #2563eb',
  },
  divider: {
    width:      1,
    height:     24,
    background: '#d1d5db',
    flexShrink: 0,
    margin:     '0 4px',
  },
  select: {
    padding:      '0.35rem 0.5rem',
    borderRadius: 4,
    border:       '1px solid #d1d5db',
    fontSize:     '0.875rem',
    height:       34,
    flexShrink:   0,
  },
  searchInput: {
    padding:      '0.35rem 0.6rem',
    borderRadius: 4,
    border:       '1px solid #d1d5db',
    fontSize:     '0.875rem',
    height:       34,
    flex:         1,         // takes all remaining space
    minWidth:     80,
    boxSizing:    'border-box',
  },
};
