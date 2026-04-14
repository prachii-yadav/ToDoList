import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import * as api from '../api/tasks';
import type {
  Task,
  TaskFilter,
  PaginatedResult,
  HistoryStatus,
  CreateTaskPayload,
} from '../types/task';

interface UseTasksReturn {
  // ── Data ────────────────────────────────────────────────────────────────────
  tasks:      Task[];
  pagination: Omit<PaginatedResult<Task>, 'data'>;
  history:    HistoryStatus;
  filter:     TaskFilter;

  // ── Status ───────────────────────────────────────────────────────────────────
  loading:  boolean;       // true while fetching the task list
  mutating: boolean;       // true while add/complete/delete/undo/redo is in flight
  error:    string | null;

  // ── Actions — return true on success, false on error ─────────────────────────
  addTask:      (payload: CreateTaskPayload) => Promise<boolean>;
  completeTask: (id: string) => Promise<boolean>;
  deleteTask:   (id: string) => Promise<boolean>;
  undoAction:   () => Promise<boolean>;
  redoAction:   () => Promise<boolean>;
  setFilter:    (filter: TaskFilter) => void;
  clearError:   () => void;
}

const DEFAULT_HISTORY: HistoryStatus = {
  canUndo: false, canRedo: false, undoCount: 0, redoCount: 0,
};

const DEFAULT_PAGINATION: Omit<PaginatedResult<Task>, 'data'> = {
  total: 0, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false,
};

// ── Error extraction ──────────────────────────────────────────────────────────
/**
 * Extracts a human-readable message from any thrown value.
 * Handles Zod issues array, plain backend error string, network errors, and JS Errors.
 */
function extractMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;

    if (Array.isArray(data?.['issues'])) {
      const issues = data['issues'] as { field: string; message: string }[];
      return issues.map(i => `${i.field}: ${i.message}`).join(' · ');
    }

    if (typeof data?.['error'] === 'string') {
      return data['error'];
    }

    if (!err.response) {
      return 'Network error — is the server running?';
    }
  }

  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTasks(): UseTasksReturn {
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [pagination, setPagination] = useState<Omit<PaginatedResult<Task>, 'data'>>(DEFAULT_PAGINATION);
  const [history,    setHistory]    = useState<HistoryStatus>(DEFAULT_HISTORY);
  const [filter,     setFilter]     = useState<TaskFilter>({});
  const [loading,    setLoading]    = useState(false);
  const [mutating,   setMutating]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // useRef lock — synchronous and stable, so it doesn't appear in dep arrays.
  // setMutating is still called to drive button disabled states.
  const mutatingRef = useRef(false);

  // ── Data Fetching ─────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async (activeFilter: TaskFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTasks(activeFilter);
      setTasks(result.data);
      const { data: _data, ...meta } = result;
      setPagination(meta);
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const h = await api.getHistory();
      setHistory(h);
    } catch {
      // Non-critical — undo/redo buttons stay in last-known state
    }
  }, []);

  // Re-fetch whenever the filter changes
  useEffect(() => {
    void fetchTasks(filter);
  }, [filter, fetchTasks]);

  // Fetch undo/redo status on mount
  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // ── Mutation wrapper ──────────────────────────────────────────────────────────
  // Returns true on success, false on failure (error state is set).
  // Empty dep array keeps this stable so action callbacks aren't recreated on every render.
  const withMutation = useCallback(async (op: () => Promise<void>): Promise<boolean> => {
    if (mutatingRef.current) return false; // already in flight — drop the call
    mutatingRef.current = true;
    setMutating(true);
    setError(null);
    try {
      await op();
      return true;
    } catch (err) {
      setError(extractMessage(err));
      return false;
    } finally {
      mutatingRef.current = false;
      setMutating(false);
    }
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const addTask = useCallback(
    (payload: CreateTaskPayload): Promise<boolean> =>
      withMutation(async () => {
        await api.createTask(payload);
        await Promise.all([fetchTasks(filter), fetchHistory()]);
      }),
    [filter, fetchTasks, fetchHistory, withMutation],
  );

  const completeTask = useCallback(
    (id: string): Promise<boolean> =>
      withMutation(async () => {
        await api.completeTask(id);
        await Promise.all([fetchTasks(filter), fetchHistory()]);
      }),
    [filter, fetchTasks, fetchHistory, withMutation],
  );

  const deleteTask = useCallback(
    (id: string): Promise<boolean> =>
      withMutation(async () => {
        await api.deleteTask(id);
        await Promise.all([fetchTasks(filter), fetchHistory()]);
      }),
    [filter, fetchTasks, fetchHistory, withMutation],
  );

  const undoAction = useCallback(
    (): Promise<boolean> =>
      withMutation(async () => {
        const result = await api.undoAction();
        setHistory(result.history);
        await fetchTasks(filter);
      }),
    [filter, fetchTasks, withMutation],
  );

  const redoAction = useCallback(
    (): Promise<boolean> =>
      withMutation(async () => {
        const result = await api.redoAction();
        setHistory(result.history);
        await fetchTasks(filter);
      }),
    [filter, fetchTasks, withMutation],
  );

  return {
    tasks,
    pagination,
    history,
    filter,
    loading,
    mutating,
    error,
    addTask,
    completeTask,
    deleteTask,
    undoAction,
    redoAction,
    setFilter,
    clearError: () => setError(null),
  };
}
