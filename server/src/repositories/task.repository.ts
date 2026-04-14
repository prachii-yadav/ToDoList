import { Task } from '../models/task.model';
import { ITaskFilter, IPaginatedResult } from '../types/task.types';

/** Storage abstraction. TaskService depends on this — not on any concrete class. */
export interface ITaskRepository {
  save(task: Task): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  findByFilter(filter: ITaskFilter): Promise<IPaginatedResult<Task>>;
  delete(id: string): Promise<boolean>;
  replaceAll(tasks: Task[]): Promise<void>; // used by Memento to restore state
}
