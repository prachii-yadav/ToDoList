/**
 * Frontend Task types — mirror the backend ITaskData / ITaskFilter shapes.
 * These are plain interfaces (no classes), keeping the frontend dependency-free
 * from backend internals.
 */

export type TaskStatus   = 'pending' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type SortField    = 'createdAt' | 'dueDate' | 'priority';
export type SortOrder    = 'asc' | 'desc';

export interface Task {
  id:          string;
  description: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  tags:        string[];
  dueDate:     string | null; // ISO date string from JSON
  createdAt:   string;
  updatedAt:   string;
}

export interface PaginatedResult<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export interface HistoryStatus {
  canUndo:   boolean;
  canRedo:   boolean;
  undoCount: number;
  redoCount: number;
}

// ── API request types ─────────────────────────────────────────────────────────

export interface CreateTaskPayload {
  description: string;
  dueDate?:    string | null;
  tags?:       string[];
  priority?:   TaskPriority;
}

export interface TaskFilter {
  status?:    TaskStatus;
  priority?:  TaskPriority;
  tag?:       string;
  search?:    string;
  sortBy?:    SortField;
  sortOrder?: SortOrder;
  page?:      number;
  limit?:     number;
}
