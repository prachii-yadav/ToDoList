import { v4 as uuidv4 } from 'uuid';
import { Task } from '../../models/task.model';
import { TaskPriority } from '../../types/task.types';

/**
 * TaskBuilder — Builder Pattern implementation.
 *
 * WHY: Task has required fields (description) and several optional ones
 * (dueDate, tags, priority). A telescoping constructor would be unwieldy and
 * fragile. The builder gives a fluent, readable API and validates state before
 * handing back a fully constructed Task.
 *
 * USAGE:
 *   const task = new TaskBuilder('Buy groceries')
 *     .withDueDate(new Date('2026-04-20'))
 *     .withTags(['personal', 'errands'])
 *     .withPriority(TaskPriority.HIGH)
 *     .build();
 *
 * SOLID — Single Responsibility:
 *   TaskBuilder is only responsible for constructing a Task.
 *   It knows nothing about persistence or business logic.
 */
export class TaskBuilder {
  // ── Internal State ─────────────────────────────────────────────────────────
  private readonly _description: string;
  private _priority: TaskPriority  = TaskPriority.MEDIUM; // default
  private _tags: string[]          = [];                  // default: no tags
  private _dueDate: Date | null    = null;                // default: no due date

  /**
   * @param description  The task description — required, validated on build()
   */
  constructor(description: string) {
    this._description = description;
  }

  // ── Fluent Setters ─────────────────────────────────────────────────────────

  /**
   * Set the due date for this task.
   * @throws Error if the provided date is in the past
   */
  withDueDate(date: Date): this {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // compare at day granularity

    const due = new Date(date);
    due.setHours(0, 0, 0, 0);

    if (due < now) {
      throw new Error(`Due date cannot be in the past. Received: ${date.toISOString()}`);
    }

    this._dueDate = new Date(date); // defensive copy
    return this; // return 'this' to enable method chaining
  }

  /**
   * Set tags for this task. Duplicates are silently removed.
   * @throws Error if any tag is an empty string
   */
  withTags(tags: string[]): this {
    const cleaned = tags.map(t => t.trim()).filter(Boolean);

    if (cleaned.length !== tags.length) {
      throw new Error('Tags must be non-empty strings.');
    }

    // Remove duplicates (case-insensitive)
    this._tags = [...new Set(cleaned.map(t => t.toLowerCase()))];
    return this;
  }

  /**
   * Set the priority level for this task.
   */
  withPriority(priority: TaskPriority): this {
    this._priority = priority;
    return this;
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  /**
   * Validate all collected state and construct the final Task instance.
   *
   * @throws Error if description is missing or blank
   * @returns A fully initialized, immutable Task
   */
  build(): Task {
    const trimmedDescription = this._description.trim();

    if (!trimmedDescription) {
      throw new Error('Task description is required and cannot be empty.');
    }

    return new Task(
      uuidv4(),                // auto-generate unique ID
      trimmedDescription,
      this._priority,
      this._tags,
      this._dueDate,
      new Date(),              // createdAt = now
    );
  }
}
