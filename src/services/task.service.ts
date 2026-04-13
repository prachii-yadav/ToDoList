import { ITaskRepository } from '../repositories/task.repository';
import { TaskBuilder } from '../patterns/builder/task.builder';
import { TaskCaretaker } from '../patterns/memento/task.caretaker';
import { Task } from '../models/task.model';
import { ITaskData, ITaskFilter, IPaginatedResult } from '../types/task.types';
import { CreateTaskInput, FilterTasksInput } from '../validators/task.validator';
import { NotFoundError, ValidationError } from '../utils/app-error';
import logger from '../utils/logger';

// Re-export so callers that import errors from the service still work
export { NotFoundError, ValidationError };

/**
 * TaskService — all business logic lives here.
 *
 * SOLID principles applied:
 *  - Single Responsibility : orchestrates use-cases; no HTTP, no storage details
 *  - Open/Closed           : depends on ITaskRepository interface, not concrete class
 *  - Dependency Inversion  : both repository and caretaker are injected via constructor
 *
 * MEMENTO INTEGRATION:
 *   Every mutating operation follows this exact pattern:
 *     1. Get current state from repository
 *     2. Tell caretaker to save a snapshot (saveSnapshot)
 *     3. Perform the mutation
 *   This gives undo the ability to rewind to before any single change.
 */
export class TaskService {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly caretaker: TaskCaretaker,  // injected — not new'd here
  ) {}

  // ── Add Task ───────────────────────────────────────────────────────────────

  /**
   * Create and persist a new task using the Builder pattern.
   * Saves a snapshot BEFORE adding so undo removes the new task.
   */
  addTask(input: CreateTaskInput): ITaskData {
    logger.info(`Adding task: "${input.description}"`);

    // ── Memento: snapshot current state before mutation ──
    this.caretaker.saveSnapshot(this._currentState());

    // Build the Task object — Builder handles validation and defaults
    const builder = new TaskBuilder(input.description);
    if (input.priority)      builder.withPriority(input.priority);
    if (input.tags?.length)  builder.withTags(input.tags);
    if (input.dueDate)       builder.withDueDate(new Date(input.dueDate));

    const task = builder.build();
    this.taskRepository.save(task);

    logger.info(`Task created with id: ${task.id}`);
    return task.toData();
  }

  // ── Complete Task ──────────────────────────────────────────────────────────

  /**
   * Mark a task as completed.
   * Saves a snapshot BEFORE completing so undo restores the pending status.
   * @throws NotFoundError if the task does not exist
   */
  completeTask(id: string): ITaskData {
    logger.info(`Completing task: ${id}`);

    const task = this.taskRepository.findById(id);
    if (!task) throw new NotFoundError(`Task with id "${id}" not found.`);

    // ── Memento: snapshot before mutation ──
    this.caretaker.saveSnapshot(this._currentState());

    task.complete();
    this.taskRepository.save(task);

    logger.info(`Task completed: ${id}`);
    return task.toData();
  }

  // ── Delete Task ────────────────────────────────────────────────────────────

  /**
   * Delete a task by ID.
   * Saves a snapshot BEFORE deleting so undo restores the deleted task.
   * @throws NotFoundError if the task does not exist
   */
  deleteTask(id: string): void {
    logger.info(`Deleting task: ${id}`);

    const exists = this.taskRepository.findById(id);
    if (!exists) throw new NotFoundError(`Task with id "${id}" not found.`);

    // ── Memento: snapshot before mutation ──
    this.caretaker.saveSnapshot(this._currentState());

    this.taskRepository.delete(id);
    logger.info(`Task deleted: ${id}`);
  }

  // ── Get Tasks ──────────────────────────────────────────────────────────────

  /**
   * Retrieve tasks matching the given filter (status, priority, tag, search, sort).
   * Returns a paginated result envelope — page/limit default to 1/20 if omitted.
   * Read-only — no snapshot taken, no undo entry created.
   */
  getTasks(input: FilterTasksInput = {}): IPaginatedResult<ITaskData> {
    const filter: ITaskFilter = {
      status:    input.status,
      priority:  input.priority,
      tag:       input.tag,
      search:    input.search,
      sortBy:    input.sortBy,
      sortOrder: input.sortOrder,
      page:      input.page,
      limit:     input.limit,
    };

    const paginated = this.taskRepository.findByFilter(filter);

    logger.info(
      `Fetched ${paginated.data.length}/${paginated.total} task(s) ` +
      `[page ${paginated.page}/${paginated.totalPages}, filter: ${JSON.stringify(filter)}]`
    );

    return {
      ...paginated,
      data: paginated.data.map(task => task.toData()),
    };
  }

  /**
   * Retrieve a single task by ID.
   * @throws NotFoundError if the task does not exist
   */
  getTaskById(id: string): ITaskData {
    const task = this.taskRepository.findById(id);
    if (!task) throw new NotFoundError(`Task with id "${id}" not found.`);
    return task.toData();
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  /**
   * Undo the last mutating action (add / complete / delete).
   * Restores the task list to its state before that action.
   *
   * @returns The restored task list
   * @throws  Error if there is nothing to undo
   */
  undo(): ITaskData[] {
    logger.info('Performing undo');

    // Give caretaker the current state (it will push to redoStack),
    // and get back the previous state
    const previousState = this.caretaker.undo(this._currentState());

    // Rebuild Task instances from plain data and replace the store
    this.taskRepository.replaceAll(
      previousState.map(data => Task.fromData(data))
    );

    logger.info(`Undo complete. Restored ${previousState.length} task(s).`);
    return previousState;
  }

  // ── Redo ──────────────────────────────────────────────────────────────────

  /**
   * Redo the last undone action.
   * Re-applies the action that was most recently undone.
   *
   * @returns The re-applied task list
   * @throws  Error if there is nothing to redo
   */
  redo(): ITaskData[] {
    logger.info('Performing redo');

    const nextState = this.caretaker.redo(this._currentState());

    this.taskRepository.replaceAll(
      nextState.map(data => Task.fromData(data))
    );

    logger.info(`Redo complete. Restored ${nextState.length} task(s).`);
    return nextState;
  }

  // ── History Metadata ──────────────────────────────────────────────────────

  /**
   * Returns current undo/redo availability — useful for API clients
   * to know whether to enable/disable undo/redo buttons.
   */
  getHistoryStatus(): { canUndo: boolean; canRedo: boolean; undoCount: number; redoCount: number } {
    return {
      canUndo:   this.caretaker.canUndo,
      canRedo:   this.caretaker.canRedo,
      undoCount: this.caretaker.undoCount,
      redoCount: this.caretaker.redoCount,
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Capture the full current task list as plain ITaskData[].
   * Used to feed the caretaker before every mutation.
   */
  private _currentState(): ITaskData[] {
    return this.taskRepository.findAll().map(task => task.toData());
  }
}

