import { useState } from 'react';
import type { CreateTaskPayload, TaskPriority } from '../types/task';

interface Props {
  onAdd:    (payload: CreateTaskPayload) => void;
  mutating: boolean; // true while any mutation is in flight (prevents double-submit)
}

const MAX_DESC  = 500;
const MAX_TAGS  = 10;
const MAX_TAG_L = 50;

/**
 * TaskInput — the "add task" form.
 *
 * Owns its own local form state (description, dueDate, priority, tags).
 * Validates client-side before calling props.onAdd — mirrors the backend
 * Zod constraints so users get instant feedback without a round-trip.
 * On successful submit it resets itself.
 */
export default function TaskInput({ onAdd, mutating }: Props) {
  const [description, setDescription] = useState('');
  const [dueDate,     setDueDate]     = useState('');
  const [priority,    setPriority]    = useState<TaskPriority>('medium');
  const [tagsInput,   setTagsInput]   = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function validate(): string | null {
    const trimmed = description.trim();
    if (!trimmed)              return 'Description is required.';
    if (trimmed.length > MAX_DESC) return `Description cannot exceed ${MAX_DESC} characters.`;

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length > MAX_TAGS)    return `A task cannot have more than ${MAX_TAGS} tags.`;
    const longTag = tags.find(t => t.length > MAX_TAG_L);
    if (longTag)                   return `Tag "${longTag}" exceeds ${MAX_TAG_L} characters.`;

    return null;
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    const msg = validate();
    if (msg) { setValidationError(msg); return; }
    setValidationError(null);

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    // <input type="date"> gives "YYYY-MM-DD"; backend Zod schema requires
    // a full ISO 8601 datetime string — append midnight UTC.
    const dueDateISO = dueDate ? `${dueDate}T00:00:00.000Z` : null;

    onAdd({
      description: description.trim(),
      dueDate:     dueDateISO,
      priority,
      tags:        tags.length ? tags : undefined,
    });

    setDescription('');
    setDueDate('');
    setPriority('medium');
    setTagsInput('');
  }

  const charsLeft = MAX_DESC - description.length;
  const nearLimit = charsLeft <= 50;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {/* ── Description row ─────────────────────────────────── */}
      <div style={styles.row}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            style={{
              ...styles.mainInput,
              borderColor: validationError ? '#ef4444' : '#ccc',
            }}
            type="text"
            placeholder="What needs to be done?"
            value={description}
            onChange={e => { setDescription(e.target.value); setValidationError(null); }}
            disabled={mutating}
            maxLength={MAX_DESC}
            aria-label="Task description"
          />
          {nearLimit && (
            <span style={{ ...styles.charCount, color: charsLeft <= 10 ? '#ef4444' : '#f59e0b' }}>
              {charsLeft}
            </span>
          )}
        </div>
        <button
          style={{ ...styles.addBtn, opacity: mutating ? 0.6 : 1 }}
          type="submit"
          disabled={mutating || !description.trim()}
        >
          {mutating ? '…' : 'Add'}
        </button>
      </div>

      {/* ── Inline validation error ─────────────────────────── */}
      {validationError && (
        <p style={styles.inlineError}>{validationError}</p>
      )}

      {/* ── Options row ─────────────────────────────────────── */}
      <div style={styles.optionsRow}>
        <label style={styles.label}>
          Priority
          <select
            style={styles.select}
            value={priority}
            onChange={e => setPriority(e.target.value as TaskPriority)}
            disabled={mutating}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label style={styles.label}>
          Due date
          <input
            style={{ ...styles.dateInput, color: dueDate ? '#111' : '#999' }}
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            disabled={mutating}
          />
        </label>

        <label style={styles.label}>
          Tags (comma-separated, max {MAX_TAGS}) 
          <input
            style={styles.tagsInput}
            type="text"
            placeholder="e.g. work, urgent"
            value={tagsInput}
            onChange={e => { setTagsInput(e.target.value); setValidationError(null); }}
            disabled={mutating}
          />
        </label>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    background:   '#f9f9f9',
    border:       '1px solid #e0e0e0',
    borderRadius: 8,
    padding:      '1rem',
    marginBottom: '1.5rem',
  },
  row: {
    display:      'flex',
    gap:          8,
    marginBottom: 4,
  },
  mainInput: {
    width:        '100%',
    padding:      '0.5rem 0.75rem',
    fontSize:     '1rem',
    border:       '1px solid #ccc',
    borderRadius: 4,
    boxSizing:    'border-box',
  },
  charCount: {
    position:   'absolute',
    right:      8,
    bottom:     6,
    fontSize:   '0.72rem',
    fontWeight: 600,
  },
  inlineError: {
    margin:     '0 0 8px',
    fontSize:   '0.8rem',
    color:      '#ef4444',
    fontWeight: 500,
  },
  addBtn: {
    padding:      '0.5rem 1.25rem',
    fontSize:     '1rem',
    background:   '#2563eb',
    color:        '#fff',
    border:       'none',
    borderRadius: 4,
    cursor:       'pointer',
    flexShrink:   0,
  },
  optionsRow: {
    display:     'flex',
    gap:         12,
    flexWrap:    'nowrap',   // keep all three on one line always
    marginTop:   8,
    alignItems:  'flex-end', // bottom-align so inputs sit on the same baseline
  },
  label: {
    display:       'flex',
    flexDirection: 'column',
    fontSize:      '0.8rem',
    color:         '#555',
    gap:           2,
    flex:          1,        // each column grows equally
    minWidth:      0,        // allow shrinking below content size
  },
  hint: {
    color:    '#999',
    fontSize: '0.72rem',
  },
  select: {
    padding:      '0.3rem 0.5rem',
    borderRadius: 4,
    border:       '1px solid #ccc',
    fontSize:     '0.9rem',
    width:        '100%',    // fill the label column
    boxSizing:    'border-box',
  },
  dateInput: {
    padding:      '0.3rem 0.5rem',
    borderRadius: 4,
    border:       '1px solid #ccc',
    fontSize:     '0.9rem',
    width:        '100%',
    boxSizing:    'border-box',
  },
  tagsInput: {
    padding:      '0.3rem 0.5rem',
    borderRadius: 4,
    border:       '1px solid #ccc',
    fontSize:     '0.9rem',
    width:        '100%',
    boxSizing:    'border-box',
  },
};
