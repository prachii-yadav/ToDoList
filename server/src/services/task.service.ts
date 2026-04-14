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
 * All business logic lives here — no HTTP concerns, no storage details.
 * Every mutation snapshots state via the caretaker BEFORE acting, enabling undo/redo.
 * Repository and caretaker are injected so this class never instantiates its own deps.
 */
export class TaskService {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly caretaker: TaskCaretaker,  // injected — not new'd here
  ) {}

  // ── Add Task ───────────────────────────────────────────────────────────────

  /** Creates a task via TaskBuilder and saves it. Snapshots state first for undo. */
  async addTask(input: CreateTaskInput): Promise<ITaskData> {
    logger.info(`Adding task: "${input.description}"`);

    this.caretaker.saveSnapshot(await this._currentState());

    // Builder handles validation and defaults
    const builder = new TaskBuilder(input.description);
    if (input.priority)      builder.withPriority(input.priority);
    if (input.tags?.length)  builder.withTags(input.tags);
    if (input.dueDate)       builder.withDueDate(new Date(input.dueDate));

    const task = builder.build();
    await this.taskRepository.save(task);

    logger.info(`Task created with id: ${task.id}`);
    return task.toData();
  }

  // ── Complete Task ──────────────────────────────────────────────────────────

  /**
   * Marks a task as completed. Snapshots state first for undo.
   * @throws NotFoundError if the task does not exist
   */
  async completeTask(id: string): Promise<ITaskData> {
    logger.info(`Completing task: ${id}`);

    const task = await this.taskRepository.findById(id);
    if (!task) throw new NotFoundError(`Task with id "${id}" not found.`);

    this.caretaker.saveSnapshot(await this._currentState());

    task.complete();
    await this.taskRepository.save(task);

    logger.info(`Task completed: ${id}`);
    return task.toData();
  }

  // ── Delete Task ────────────────────────────────────────────────────────────

  /**
   * Deletes a task by ID. Snapshots state first for undo.
   * @throws NotFoundError if the task does not exist
   */
  async deleteTask(id: string): Promise<void> {
    logger.info(`Deleting task: ${id}`);

    const exists = await this.taskRepository.findById(id);
    if (!exists) throw new NotFoundError(`Task with id "${id}" not found.`);

    this.caretaker.saveSnapshot(await this._currentState());

    await this.taskRepository.delete(id);
    logger.info(`Task deleted: ${id}`);
  }

  // ── Get Tasks ──────────────────────────────────────────────────────────────

  /** Returns filtered, sorted, paginated tasks. Read-only — no snapshot taken. */
  async getTasks(input: FilterTasksInput = {}): Promise<IPaginatedResult<ITaskData>> {
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

    const paginated = await this.taskRepository.findByFilter(filter);

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
  async getTaskById(id: string): Promise<ITaskData> {
    const task = await this.taskRepository.findById(id);
    if (!task) throw new NotFoundError(`Task with id "${id}" not found.`);
    return task.toData();
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  /**
   * Undoes the last action and restores the previous task list.
   * @throws Error if there is nothing to undo
   */
  async undo(): Promise<ITaskData[]> {
    logger.info('Performing undo');

    const previousState = this.caretaker.undo(await this._currentState());

    await this.taskRepository.replaceAll(
      previousState.map(data => Task.fromData(data))
    );

    logger.info(`Undo complete. Restored ${previousState.length} task(s).`);
    return previousState;
  }

  // ── Redo ──────────────────────────────────────────────────────────────────

  /**
   * Re-applies the most recently undone action.
   * @throws Error if there is nothing to redo
   */
  async redo(): Promise<ITaskData[]> {
    logger.info('Performing redo');

    const nextState = this.caretaker.redo(await this._currentState());

    await this.taskRepository.replaceAll(
      nextState.map(data => Task.fromData(data))
    );

    logger.info(`Redo complete. Restored ${nextState.length} task(s).`);
    return nextState;
  }

  // ── History Metadata ──────────────────────────────────────────────────────

  /** Returns undo/redo availability for the client to enable/disable those buttons. */
  getHistoryStatus(): { canUndo: boolean; canRedo: boolean; undoCount: number; redoCount: number } {
    return {
      canUndo:   this.caretaker.canUndo,
      canRedo:   this.caretaker.canRedo,
      undoCount: this.caretaker.undoCount,
      redoCount: this.caretaker.redoCount,
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  /** Snapshots the full task list as plain data — fed to the caretaker before every mutation. */
  private async _currentState(): Promise<ITaskData[]> {
    return (await this.taskRepository.findAll()).map(task => task.toData());
  }
}
