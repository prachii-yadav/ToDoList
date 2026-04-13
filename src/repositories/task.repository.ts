import { Task } from '../models/task.model';
import { ITaskFilter, IPaginatedResult, SortField, SortOrder, TaskPriority } from '../types/task.types';

/**
 * ITaskRepository — abstraction over storage.
 *
 * SOLID — Open/Closed + Dependency Inversion:
 *   The service depends on this interface, not on InMemoryTaskRepository.
 *   Swapping to a database later means writing a new class that implements
 *   this interface — zero changes to the service.
 */
export interface ITaskRepository {
  save(task: Task): Task;
  findById(id: string): Task | null;
  findAll(): Task[];
  findByFilter(filter: ITaskFilter): IPaginatedResult<Task>;
  delete(id: string): boolean;
  replaceAll(tasks: Task[]): void; // used by Memento to restore state
}

/**
 * InMemoryTaskRepository — stores tasks in a Map for O(1) lookups by ID.
 *
 * SOLID — Single Responsibility:
 *   This class is ONLY responsible for CRUD + filtered queries on in-memory
 *   storage. No business rules, no HTTP concerns.
 */
export class InMemoryTaskRepository implements ITaskRepository {
  // Map gives O(1) get/set/delete by task ID; preserves insertion order
  private readonly store: Map<string, Task> = new Map();

  // Priority weights for sorting — lower number = lower priority
  private static readonly PRIORITY_WEIGHT: Record<TaskPriority, number> = {
    [TaskPriority.LOW]:    1,
    [TaskPriority.MEDIUM]: 2,
    [TaskPriority.HIGH]:   3,
  };

  // ── Write Operations ───────────────────────────────────────────────────────

  /**
   * Persist a task. Overwrites if the ID already exists.
   * @returns The same task (for service-layer convenience)
   */
  save(task: Task): Task {
    this.store.set(task.id, task);
    return task;
  }

  /**
   * Replace the entire store with a new set of tasks.
   * Used exclusively by the Memento caretaker to restore a prior state snapshot.
   */
  replaceAll(tasks: Task[]): void {
    this.store.clear();
    for (const task of tasks) {
      this.store.set(task.id, task);
    }
  }

  /**
   * Remove a task by ID.
   * @returns true if deleted, false if the ID was not found
   */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  // ── Read Operations ────────────────────────────────────────────────────────

  /**
   * Look up a task by its ID.
   * @returns The Task, or null if not found (never throws)
   */
  findById(id: string): Task | null {
    return this.store.get(id) ?? null;
  }

  /**
   * Return all tasks. Order reflects Map insertion order.
   */
  findAll(): Task[] {
    return Array.from(this.store.values());
  }

  /**
   * Return tasks matching the given filter, with optional sorting.
   *
   * Filtering is applied first, then sorting. An empty filter object
   * returns all tasks sorted by createdAt asc (insertion order default).
   *
   * Performance note: O(n) scan is fine for in-memory storage.
   * A database implementation would translate this to SQL WHERE + ORDER BY.
   */
  findByFilter(filter: ITaskFilter): IPaginatedResult<Task> {
    let results = Array.from(this.store.values());

    // ── Apply Filters ─────────────────────────────────────────────────────

    if (filter.status) {
      results = results.filter(t => t.status === filter.status);
    }

    if (filter.priority) {
      results = results.filter(t => t.priority === filter.priority);
    }

    if (filter.tag) {
      // Case-insensitive tag match
      const targetTag = filter.tag.toLowerCase().trim();
      results = results.filter(t =>
        t.tags.some(tag => tag.toLowerCase() === targetTag)
      );
    }

    if (filter.search) {
      // Case-insensitive substring match on description
      const keyword = filter.search.toLowerCase().trim();
      results = results.filter(t =>
        t.description.toLowerCase().includes(keyword)
      );
    }

    // ── Apply Sorting ─────────────────────────────────────────────────────

    const sortBy    = filter.sortBy    ?? SortField.CREATED_AT;
    const sortOrder = filter.sortOrder ?? SortOrder.ASC;
    const direction = sortOrder === SortOrder.ASC ? 1 : -1;

    results.sort((a, b) => {
      switch (sortBy) {
        case SortField.CREATED_AT: {
          return direction * (a.createdAt.getTime() - b.createdAt.getTime());
        }

        case SortField.DUE_DATE: {
          // Tasks with no due date sort to the end regardless of direction
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return direction * (a.dueDate.getTime() - b.dueDate.getTime());
        }

        case SortField.PRIORITY: {
          const wa = InMemoryTaskRepository.PRIORITY_WEIGHT[a.priority];
          const wb = InMemoryTaskRepository.PRIORITY_WEIGHT[b.priority];
          return direction * (wa - wb);
        }

        default:
          return 0;
      }
    });

    // ── Apply Pagination ──────────────────────────────────────────────────
    const total      = results.length;
    const page       = filter.page  ?? 1;
    const limit      = filter.limit ?? 20;
    const totalPages = Math.ceil(total / limit) || 1;
    const start      = (page - 1) * limit;
    const data       = results.slice(start, start + limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
