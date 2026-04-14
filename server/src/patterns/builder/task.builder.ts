import { v4 as uuidv4 } from 'uuid';
import { Task } from '../../models/task.model';
import { TaskPriority } from '../../types/task.types';

/**
 * Fluent builder for Task. Validates all inputs and constructs a fully initialized Task.
 * Responsible only for construction — knows nothing about persistence or business rules.
 */
export class TaskBuilder {
  // ── Internal State ─────────────────────────────────────────────────────────
  private readonly _description: string;
  private _priority: TaskPriority  = TaskPriority.MEDIUM; // default
  private _tags: string[]          = [];                  // default: no tags
  private _dueDate: Date | null    = null;                // default: no due date

  /** @param description Required — validated in build() */
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

    this._dueDate = new Date(date);
    return this;
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
   * Validates state and constructs the Task.
   * @throws Error if description is blank
   */
  build(): Task {
    const trimmedDescription = this._description.trim();

    if (!trimmedDescription) {
      throw new Error('Task description is required and cannot be empty.');
    }

    return new Task(
      uuidv4(),
      trimmedDescription,
      this._priority,
      this._tags,
      this._dueDate,
      new Date(),
    );
  }
}
