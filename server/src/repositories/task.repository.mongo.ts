import { Task } from '../models/task.model';
import { TaskModel } from '../db/task.schema';
import {
  ITaskFilter,
  IPaginatedResult,
  SortField,
  SortOrder,
  TaskPriority,
} from '../types/task.types';
import { ITaskRepository } from './task.repository';

/**
 * MongoDB implementation of ITaskRepository.
 * replaceAll() uses deleteMany + insertMany (not atomic) — acceptable for a single-user app.
 * Exact timestamps are preserved on insert so Memento restores state faithfully.
 */
export class MongoTaskRepository implements ITaskRepository {

  // ── Private Helper ─────────────────────────────────────────────────────────

  /** Converts a Mongoose document to a domain Task via Task.fromData(). */
  private docToTask(doc: InstanceType<typeof TaskModel>): Task {
    return Task.fromData({
      id:          doc.id as string,
      description: doc.description,
      status:      doc.status,
      priority:    doc.priority,
      tags:        doc.tags,
      dueDate:     doc.dueDate ?? null,
      createdAt:   doc.createdAt,
      updatedAt:   doc.updatedAt,
    });
  }

  // ── Write Operations ───────────────────────────────────────────────────────

  /** Upsert by UUID. Sets updatedAt explicitly to preserve Memento snapshot timestamps. */
  async save(task: Task): Promise<Task> {
    await TaskModel.findOneAndUpdate(
      { id: task.id },
      {
        id:          task.id,
        description: task.description,
        status:      task.status,
        priority:    task.priority,
        tags:        task.tags,
        dueDate:     task.dueDate,
        createdAt:   task.createdAt,
        updatedAt:   task.updatedAt,
      },
      { upsert: true, new: true }
    );
    return task;
  }

  /** Replaces the entire collection — called by Memento during undo/redo. */
  async replaceAll(tasks: Task[]): Promise<void> {
    await TaskModel.deleteMany({});

    if (tasks.length === 0) return;

    await TaskModel.insertMany(
      tasks.map(t => ({
        id:          t.id,
        description: t.description,
        status:      t.status,
        priority:    t.priority,
        tags:        t.tags,
        dueDate:     t.dueDate,
        createdAt:   t.createdAt,
        updatedAt:   t.updatedAt,
      }))
    );
  }

  /** @returns true if deleted, false if not found */
  async delete(id: string): Promise<boolean> {
    const result = await TaskModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  // ── Read Operations ────────────────────────────────────────────────────────

  /** @returns The Task, or null if not found */
  async findById(id: string): Promise<Task | null> {
    const doc = await TaskModel.findOne({ id });
    return doc ? this.docToTask(doc) : null;
  }

  /** Returns all tasks ordered by createdAt asc — used by the Memento snapshot helper. */
  async findAll(): Promise<Task[]> {
    const docs = await TaskModel.find().sort({ createdAt: 1 });
    return docs.map(doc => this.docToTask(doc));
  }

  /** Translates ITaskFilter to a MongoDB query and returns a paginated result. */
  async findByFilter(filter: ITaskFilter): Promise<IPaginatedResult<Task>> {
    // ── Build Mongo Query ────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (filter.status)   query['status']   = filter.status;
    if (filter.priority) query['priority'] = filter.priority;
    if (filter.tag)      query['tags']     = { $regex: new RegExp(`^${filter.tag.trim()}$`, 'i') };
    if (filter.search)   query['description'] = { $regex: new RegExp(filter.search.trim(), 'i') };

    // ── Sorting ──────────────────────────────────────────────────────────

    const sortField = filter.sortBy ?? SortField.CREATED_AT;
    const sortDir   = (filter.sortOrder ?? SortOrder.ASC) === SortOrder.ASC ? 1 : -1;

    // Priority requires a custom weight — we handle it in-memory after fetch
    // (avoids a MongoDB aggregation pipeline)
    const useInMemoryPrioritySort = sortField === SortField.PRIORITY;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoSort: Record<string, any> = useInMemoryPrioritySort
      ? { createdAt: 1 }  // fetch in stable order, sort in JS below
      : { [sortField]: sortDir };

    // ── Pagination ───────────────────────────────────────────────────────

    const page  = filter.page  ?? 1;
    const limit = filter.limit ?? 20;
    const skip  = (page - 1) * limit;

    // Run count + data fetch in parallel for efficiency
    const [total, docs] = await Promise.all([
      TaskModel.countDocuments(query),
      TaskModel.find(query).sort(mongoSort).skip(skip).limit(limit),
    ]);

    let tasks = docs.map(doc => this.docToTask(doc));

    // ── In-memory priority sort (only when sortBy=priority) ──────────────

    if (useInMemoryPrioritySort) {
      const WEIGHT: Record<TaskPriority, number> = {
        [TaskPriority.LOW]:    1,
        [TaskPriority.MEDIUM]: 2,
        [TaskPriority.HIGH]:   3,
      };
      tasks = tasks.sort((a, b) => sortDir * (WEIGHT[a.priority] - WEIGHT[b.priority]));
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data:       tasks,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
