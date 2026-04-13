import { z } from 'zod';
import { TaskPriority, TaskStatus, SortField, SortOrder } from '../types/task.types';

/**
 * Zod v4 validation schemas for all incoming HTTP request payloads.
 *
 * SOLID — Single Responsibility:
 *   All input validation is declared here. The controller parses incoming
 *   data through these schemas before passing anything to the service.
 */

// ── POST /tasks ──────────────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'description cannot be empty')
    .max(500, 'description cannot exceed 500 characters'),

  dueDate: z
    .iso.datetime({ message: 'dueDate must be a valid ISO 8601 datetime string' })
    .optional()
    .nullable(),

  tags: z
    .array(
      z.string().trim().min(1, 'each tag must be a non-empty string').max(50)
    )
    .max(10, 'a task cannot have more than 10 tags')
    .optional(),

  priority: z
    .enum(Object.values(TaskPriority) as [TaskPriority, ...TaskPriority[]], {
      error: `priority must be one of: ${Object.values(TaskPriority).join(', ')}`,
    })
    .optional(),
});

// ── GET /tasks — query params ─────────────────────────────────────────────────
// All fields optional. An empty query returns all tasks sorted by createdAt asc.
export const filterTasksSchema = z.object({
  // Core filters (required by spec)
  status: z
    .enum(Object.values(TaskStatus) as [TaskStatus, ...TaskStatus[]], {
      error: `status must be one of: ${Object.values(TaskStatus).join(', ')}`,
    })
    .optional(),

  // Extended filters (production enhancements)
  priority: z
    .enum(Object.values(TaskPriority) as [TaskPriority, ...TaskPriority[]], {
      error: `priority must be one of: ${Object.values(TaskPriority).join(', ')}`,
    })
    .optional(),

  tag: z
    .string()
    .trim()
    .min(1, 'tag filter cannot be empty')
    .max(50)
    .optional(),

  search: z
    .string()
    .trim()
    .min(1, 'search keyword cannot be empty')
    .max(200)
    .optional(),

  // Pagination — query strings arrive as strings, so coerce to number
  page: z
    .string()
    .regex(/^\d+$/, 'page must be a positive integer')
    .transform(Number)
    .pipe(z.number().int().min(1, 'page must be at least 1'))
    .optional(),

  limit: z
    .string()
    .regex(/^\d+$/, 'limit must be a positive integer')
    .transform(Number)
    .pipe(z.number().int().min(1, 'limit must be at least 1').max(100, 'limit cannot exceed 100'))
    .optional(),

  // Sorting
  sortBy: z
    .enum(Object.values(SortField) as [SortField, ...SortField[]], {
      error: `sortBy must be one of: ${Object.values(SortField).join(', ')}`,
    })
    .optional(),

  sortOrder: z
    .enum(Object.values(SortOrder) as [SortOrder, ...SortOrder[]], {
      error: `sortOrder must be one of: ${Object.values(SortOrder).join(', ')}`,
    })
    .optional(),
});

// ── Route param :id ───────────────────────────────────────────────────────────
export const taskIdSchema = z.object({
  id: z.uuid('task id must be a valid UUID'),
});

// ── Inferred TypeScript types from schemas ────────────────────────────────────
export type CreateTaskInput  = z.infer<typeof createTaskSchema>;
export type FilterTasksInput = z.infer<typeof filterTasksSchema>;
