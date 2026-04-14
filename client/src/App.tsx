import { useTasks }        from './hooks/useTasks';
import { useToast }        from './hooks/useToast';
import TaskInput           from './components/TaskInput';
import TaskList            from './components/TaskList';
import FilterControls      from './components/FilterControls';
import UndoRedoControls    from './components/UndoRedoControls';
import ToastContainer      from './components/ToastContainer';
import type { CreateTaskPayload } from './types/task';

function App() {
  const {
    tasks, pagination, history, filter,
    loading, mutating, error,
    addTask, completeTask, deleteTask,
    undoAction, redoAction,
    setFilter, clearError,
  } = useTasks();

  const { toasts, showToast, dismiss } = useToast();

  // ── Action wrappers — delegate to hook, show toast on success ────────────

  async function handleAdd(payload: CreateTaskPayload) {
    const ok = await addTask(payload);
    if (ok) showToast('Task added!', 'success');
  }

  async function handleComplete(id: string) {
    const ok = await completeTask(id);
    if (ok) showToast('Task marked as done!', 'success');
  }

  async function handleDelete(id: string) {
    const ok = await deleteTask(id);
    if (ok) showToast('Task deleted.', 'info');
  }

  async function handleUndo() {
    const ok = await undoAction();
    if (ok) showToast('Undo successful.', 'info');
  }

  async function handleRedo() {
    const ok = await redoAction();
    if (ok) showToast('Redo successful.', 'info');
  }

  return (
    <div style={styles.page}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={styles.header}>
        <h1 style={styles.title}>Personal To-Do List</h1>
        <UndoRedoControls
          history={history}
          loading={mutating}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      </header>

      {/* ── Add Task ────────────────────────────────────────────── */}
      <TaskInput onAdd={handleAdd} mutating={mutating} />

      {/* ── Filters ─────────────────────────────────────────────── */}
      <FilterControls filter={filter} onChange={setFilter} />

      {/* ── Error Banner ────────────────────────────────────────── */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button style={styles.dismissBtn} onClick={clearError}>✕</button>
        </div>
      )}

      {/* ── Task List ───────────────────────────────────────────── */}
      <TaskList
        tasks={tasks}
        loading={loading}
        mutating={mutating}
        onComplete={handleComplete}
        onDelete={handleDelete}
      />

      {/* ── Pagination summary ───────────────────────────────────── */}
      {pagination.total > 0 && (
        <p style={styles.paginationInfo}>
          Showing {tasks.length} of {pagination.total} task{pagination.total !== 1 ? 's' : ''}
          {pagination.totalPages > 1 && ` · Page ${pagination.page} of ${pagination.totalPages}`}
        </p>
      )}

      {/* ── Toast notifications ──────────────────────────────────── */}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth:   780,
    margin:     '0 auto',
    padding:    '1.5rem 1rem',
    fontFamily: 'system-ui, sans-serif',
    color:      '#111',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   '1.25rem',
    flexWrap:       'wrap',
    gap:            8,
  },
  title: {
    margin:     0,
    fontSize:   '1.6rem',
    fontWeight: 700,
  },
  errorBanner: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    background:     '#fef2f2',
    border:         '1px solid #fca5a5',
    borderRadius:   6,
    padding:        '0.6rem 1rem',
    marginBottom:   '0.75rem',
    color:          '#991b1b',
    fontSize:       '0.9rem',
  },
  dismissBtn: {
    background: 'transparent',
    border:     'none',
    cursor:     'pointer',
    color:      '#991b1b',
    fontSize:   '1rem',
    padding:    '0 4px',
  },
  paginationInfo: {
    marginTop: '0.75rem',
    textAlign: 'center',
    fontSize:  '0.8rem',
    color:     '#888',
  },
};

export default App;
