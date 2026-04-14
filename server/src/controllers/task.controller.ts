import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/task.service';
import {
  createTaskSchema,
  filterTasksSchema,
  taskIdSchema,
} from '../validators/task.validator';
/**
 * HTTP boundary — parses requests, delegates to TaskService, formats responses.
 * No business logic here. Errors propagate via next(err) to errorMiddleware.
 */
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  // ── POST /tasks ────────────────────────────────────────────────────────────

  /**
   * Create a new task.
   * Body: { description, dueDate?, tags?, priority? }
   */
  createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createTaskSchema.parse(req.body);
      const task  = await this.taskService.addTask(input);

      res.status(201).json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  };

  // ── PATCH /tasks/:id/complete ──────────────────────────────────────────────

  /**
   * Mark an existing task as completed.
   */
  completeTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = taskIdSchema.parse(req.params);
      const task   = await this.taskService.completeTask(id);

      res.status(200).json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  };

  // ── DELETE /tasks/:id ──────────────────────────────────────────────────────

  /**
   * Delete a task by ID.
   */
  deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = taskIdSchema.parse(req.params);
      await this.taskService.deleteTask(id);

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
  getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter    = filterTasksSchema.parse(req.query);
      const paginated = await this.taskService.getTasks(filter);

      res.status(200).json({ success: true, ...paginated });
    } catch (err) {
      next(err);
    }
  };

  // ── GET /tasks/:id ─────────────────────────────────────────────────────────

  /**
   * Retrieve a single task by ID.
   */
  getTaskById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = taskIdSchema.parse(req.params);
      const task   = await this.taskService.getTaskById(id);

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
  undo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tasks  = await this.taskService.undo();
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
  redo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tasks  = await this.taskService.redo();
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

  /** Returns undo/redo availability for the client to enable/disable those buttons. */
  getHistory = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = this.taskService.getHistoryStatus();
      res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  };
}
