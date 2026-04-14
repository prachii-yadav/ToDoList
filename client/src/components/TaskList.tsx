import type { Task } from '../types/task';
import TaskItem from './TaskItem';

interface Props {
  tasks:      Task[];
  loading:    boolean;
  mutating:   boolean;
  onComplete: (id: string) => void;
  onDelete:   (id: string) => void;
}

/**
 * TaskList — renders the list of tasks or contextual empty / loading states.
 *
 * It does NOT know about filters or pagination — the parent (App / useTasks hook)
 * decides which tasks to pass in. This keeps the component easy to test and reuse.
 */
export default function TaskList({ tasks, loading, mutating, onComplete, onDelete }: Props) {
  if (loading) {
    return <p style={styles.info}>Loading tasks…</p>;
  }

  if (tasks.length === 0) {
    return <p style={styles.info}>No tasks found. Add one above!</p>;
  }

  return (
    <ul style={styles.list}>
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          mutating={mutating}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    margin:  0,
    padding: 0,
    border:       '1px solid #e0e0e0',
    borderRadius: 8,
    overflow:     'hidden',
  },
  info: {
    color:     '#888',
    textAlign: 'center',
    padding:   '2rem',
  },
};
