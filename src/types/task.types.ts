/**
 * Shared TypeScript interfaces and enums for the Task domain.
 * All layers (model, service, controller) import from here.
 */

// ── Priority Levels ──────────────────────────────────────────────────────────
export enum TaskPriority {
  LOW    = 'low',
  MEDIUM = 'medium',
  HIGH   = 'high',
}

// ── Task Status ──────────────────────────────────────────────────────────────
export enum TaskStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
}

// ── Core Task Shape (read-only snapshot) ────────────────────────────────────
// Used when serializing a Task to JSON (e.g. API responses, memento snapshots)
export interface ITaskData {
  readonly id: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly tags: string[];
  readonly dueDate: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ── Builder Input DTO ────────────────────────────────────────────────────────
// What the builder accepts as input (only required + optional fields exposed)
export interface ITaskCreateInput {
  description: string;           // required
  dueDate?:    Date | null;      // optional
  tags?:       string[];         // optional
  priority?:   TaskPriority;     // optional, defaults to MEDIUM
}

// ── Sort Options ─────────────────────────────────────────────────────────────
export enum SortField {
  CREATED_AT = 'createdAt',
  DUE_DATE   = 'dueDate',
  PRIORITY   = 'priority',
}

export enum SortOrder {
  ASC  = 'asc',
  DESC = 'desc',
}

// ── Task Filter ───────────────────────────────────────────────────────────────
// Passed from controller → service → repository.
// All fields are optional — an empty filter returns all tasks.
export interface ITaskFilter {
  status?:    TaskStatus;   // filter by completion status
  priority?:  TaskPriority; // filter by priority level
  tag?:       string;       // filter by a single tag (case-insensitive)
  search?:    string;       // keyword search in description (case-insensitive)
  sortBy?:    SortField;    // field to sort by (default: createdAt)
  sortOrder?: SortOrder;    // asc | desc (default: asc)
  page?:      number;       // 1-based page number (default: 1)
  limit?:     number;       // items per page (default: 20, max: 100)
}

// ── Paginated Response ────────────────────────────────────────────────────────
export interface IPaginatedResult<T> {
  data:       T[];
  total:      number;   // total matching items (before pagination)
  page:       number;   // current page
  limit:      number;   // items per page
  totalPages: number;   // total number of pages
  hasNext:    boolean;
  hasPrev:    boolean;
}
