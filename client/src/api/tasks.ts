import axios from 'axios';
import type {
  Task,
  PaginatedResult,
  HistoryStatus,
  CreateTaskPayload,
  TaskFilter,
} from '../types/task';

/**
 * Axios instance — all requests share this base URL and headers.
 * Change VITE_API_URL in client/.env to point at a deployed backend.
 */
const api = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

// ── Task CRUD ─────────────────────────────────────────────────────────────────

/**
 * GET /tasks — fetch tasks with optional filters.
 * Backend returns { success, data, total, page, ... }
 */
export async function getTasks(filter: TaskFilter = {}): Promise<PaginatedResult<Task>> {
  // Remove undefined keys so they don't appear as "?status=undefined" in URL
  const params = Object.fromEntries(
    Object.entries(filter).filter(([, v]) => v !== undefined && v !== '')
  );
  const res = await api.get<PaginatedResult<Task> & { success: boolean }>('/tasks', { params });
  // Backend spreads paginated result at top level alongside `success`
  const { success: _success, ...paginated } = res.data;
  return paginated as PaginatedResult<Task>;
}

/**
 * POST /tasks — create a new task.
 */
export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const res = await api.post<{ success: boolean; data: Task }>('/tasks', payload);
  return res.data.data;
}

/**
 * PATCH /tasks/:id/complete — mark a task as completed.
 */
export async function completeTask(id: string): Promise<Task> {
  const res = await api.patch<{ success: boolean; data: Task }>(`/tasks/${id}/complete`);
  return res.data.data;
}

/**
 * DELETE /tasks/:id — delete a task.
 */
export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

// ── Undo / Redo ───────────────────────────────────────────────────────────────

export interface UndoRedoResult {
  tasks:   Task[];
  history: HistoryStatus;
}

/**
 * POST /tasks/undo — undo the last mutating action.
 * Backend returns the restored task list + history status.
 */
export async function undoAction(): Promise<UndoRedoResult> {
  const res = await api.post<{ success: boolean; data: Task[]; history: HistoryStatus }>('/tasks/undo');
  return { tasks: res.data.data, history: res.data.history };
}

/**
 * POST /tasks/redo — redo the last undone action.
 */
export async function redoAction(): Promise<UndoRedoResult> {
  const res = await api.post<{ success: boolean; data: Task[]; history: HistoryStatus }>('/tasks/redo');
  return { tasks: res.data.data, history: res.data.history };
}

/**
 * GET /tasks/history — fetch current undo/redo availability.
 */
export async function getHistory(): Promise<HistoryStatus> {
  const res = await api.get<{ success: boolean; data: HistoryStatus }>('/tasks/history');
  return res.data.data;
}
