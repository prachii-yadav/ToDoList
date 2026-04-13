import { ITaskData, TaskPriority, TaskStatus } from '../types/task.types';

/**
 * Task — the core domain class.
 *
 * Encapsulation rules:
 *  - All fields are PRIVATE. No direct mutation from outside.
 *  - State changes only through explicit methods: complete(), updateDescription().
 *  - toData() exposes a deep-copy snapshot so callers can't mutate internals.
 *
 * This class is NOT constructed directly. Use TaskBuilder instead.
 */
export class Task {
  // ── Private State ──────────────────────────────────────────────────────────
  private readonly _id: string;
  private _description: string;
  private _status: TaskStatus;
  private _priority: TaskPriority;
  private _tags: string[];
  private _dueDate: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  /**
   * Package-private constructor.
   * Intentionally not exported — only TaskBuilder should call this.
   */
  constructor(
    id: string,
    description: string,
    priority: TaskPriority,
    tags: string[],
    dueDate: Date | null,
    createdAt: Date,
  ) {
    this._id          = id;
    this._description = description;
    this._status      = TaskStatus.PENDING;    // every task starts as pending
    this._priority    = priority;
    this._tags        = [...tags];             // defensive copy
    this._dueDate     = dueDate ? new Date(dueDate) : null; // defensive copy
    this._createdAt   = new Date(createdAt);
    this._updatedAt   = new Date(createdAt);
  }

  // ── Read-only Accessors ────────────────────────────────────────────────────

  get id(): string          { return this._id; }
  get description(): string { return this._description; }
  get status(): TaskStatus  { return this._status; }
  get priority(): TaskPriority { return this._priority; }
  get tags(): string[]      { return [...this._tags]; }          // defensive copy
  get dueDate(): Date | null {
    return this._dueDate ? new Date(this._dueDate) : null;       // defensive copy
  }
  get createdAt(): Date     { return new Date(this._createdAt); }
  get updatedAt(): Date     { return new Date(this._updatedAt); }

  // ── State-Changing Methods ─────────────────────────────────────────────────

  /**
   * Mark this task as completed.
   * Idempotent — calling it on an already-completed task is a no-op.
   */
  complete(): void {
    if (this._status === TaskStatus.COMPLETED) return;
    this._status    = TaskStatus.COMPLETED;
    this._updatedAt = new Date();
  }

  /**
   * Update the task description.
   * @throws Error if the new description is blank
   */
  updateDescription(newDescription: string): void {
    const trimmed = newDescription.trim();
    if (!trimmed) {
      throw new Error('Task description cannot be empty.');
    }
    this._description = trimmed;
    this._updatedAt   = new Date();
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /**
   * Returns a plain, immutable snapshot of the task's current state.
   * Used for API responses and Memento snapshots.
   * All dates are copied to prevent external mutation.
   */
  toData(): ITaskData {
    return {
      id:          this._id,
      description: this._description,
      status:      this._status,
      priority:    this._priority,
      tags:        [...this._tags],
      dueDate:     this._dueDate ? new Date(this._dueDate) : null,
      createdAt:   new Date(this._createdAt),
      updatedAt:   new Date(this._updatedAt),
    };
  }

  /**
   * Reconstruct a Task from a plain data snapshot.
   * Used by the Memento pattern to restore prior state.
   */
  static fromData(data: ITaskData): Task {
    const task = new Task(
      data.id,
      data.description,
      data.priority,
      data.tags,
      data.dueDate,
      data.createdAt,
    );

    // Restore status and timestamps that may differ from initial creation
    task._status    = data.status;
    task._updatedAt = new Date(data.updatedAt);

    return task;
  }
}
