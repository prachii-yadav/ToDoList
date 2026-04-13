import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/task.service';
import {
  createTaskSchema,
  filterTasksSchema,
  taskIdSchema,
} from '../validators/task.validator';
/**
 * TaskController — HTTP request/response boundary.
 *
 * SOLID — Single Responsibility:
 *   This class only handles HTTP concerns: parsing, validating request shape,
 *   delegating to the service, and formatting the response.
 *   Zero business logic lives here.
 *
 * Error handling: all thrown errors are caught by next(err) and forwarded
 * to errorMiddleware — no try/catch duplication in each method.
 */
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  // ── POST /tasks ────────────────────────────────────────────────────────────

  /**
   * Create a new task.
   * Body: { description, dueDate?, tags?, priority? }
   */
  createTask = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const input = createTaskSchema.parse(req.body);
      const task  = this.taskService.addTask(input);

      res.status(201).json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /tasks/:id/complete ──────────────────────────────────────────────

  /**
   * Mark an existing task as completed.
   */
  completeTask = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = taskIdSchema.parse(req.params);
      const task   = this.taskService.completeTask(id);

      res.status(200).json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /tasks/:id ──────────────────────────────────────────────────────

  /**
   * Delete a task by ID.
   */
  deleteTask = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = taskIdSchema.parse(req.params);
      this.taskService.deleteTask(id);

      res.status(200).json({ success: true, message: `Task ${id} deleted.` });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /tasks ─────────────────────────────────────────────────────────────

  /**
   * Retrieve tasks — all, completed, or pending.
   * Query: ?status=completed | ?status=pending
   */
  getTasks = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const filter    = filterTasksSchema.parse(req.query);
      const paginated = this.taskService.getTasks(filter);

      res.status(200).json({ success: true, ...paginated });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /tasks/:id ─────────────────────────────────────────────────────────

  /**
   * Retrieve a single task by ID.
   */
  getTaskById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = taskIdSchema.parse(req.params);
      const task   = this.taskService.getTaskById(id);

      res.status(200).json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /tasks/undo ───────────────────────────────────────────────────────

  /**
   * Undo the last mutating action (add / complete / delete).
   * Returns the restored task list so the client can refresh its view.
   */
  undo = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const tasks  = this.taskService.undo();
      const status = this.taskService.getHistoryStatus();

      res.status(200).json({
        success: true,
        message: 'Undo successful.',
        history: status,
        data:    tasks,
      });
    } catch (err) {
      next(err);
    }
  };

  // ── POST /tasks/redo ───────────────────────────────────────────────────────

  /**
   * Redo the last undone action.
   * Returns the re-applied task list so the client can refresh its view.
   */
  redo = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const tasks  = this.taskService.redo();
      const status = this.taskService.getHistoryStatus();

      res.status(200).json({
        success: true,
        message: 'Redo successful.',
        history: status,
        data:    tasks,
      });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /tasks/history ────────────────────────────────────────────────────

  /**
   * Returns undo/redo availability metadata.
   * Useful for a frontend to know whether to enable/disable undo/redo buttons.
   */
  getHistory = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const status = this.taskService.getHistoryStatus();
      res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  };
}
