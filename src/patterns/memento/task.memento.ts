import { ITaskData } from '../../types/task.types';

/**
 * TaskMemento — Memento Pattern: the snapshot object.
 *
 * WHAT IT DOES:
 *   Captures a complete, immutable copy of the task list at a point in time.
 *   The Caretaker stores these snapshots; the Service restores them on undo/redo.
 *
 * ENCAPSULATION RULE:
 *   The snapshot data is private and read-only.
 *   Only getState() exposes it — and even then it returns a deep copy so the
 *   caller cannot mutate the saved snapshot.
 *
 * WHY SNAPSHOT THE WHOLE LIST:
 *   Because any single operation (add/delete/complete) can affect the meaning
 *   of the full list state. Storing the entire list per action is the cleanest
 *   approach for in-memory storage with a small dataset.
 */
export class TaskMemento {
  // Timestamp helps with debugging — you can see when each snapshot was taken
  private readonly _timestamp: Date;

  // Deep-frozen array of plain task data — no Task class instances stored here
  // (Task instances are mutable; ITaskData is a plain object — safe to snapshot)
  private readonly _state: ReadonlyArray<Readonly<ITaskData>>;

  constructor(state: ITaskData[]) {
    this._timestamp = new Date();

    // Deep copy every task's data to prevent external mutation of the snapshot
    this._state = Object.freeze(
      state.map(task => Object.freeze({ ...task }))
    );
  }

  /**
   * Returns a deep copy of the snapshotted state.
   * Returns a copy (not the frozen reference) so the caller can safely
   * pass it to Task.fromData() without hitting the freeze constraint.
   */
  getState(): ITaskData[] {
    return this._state.map(task => ({ ...task }));
  }

  /** When was this snapshot taken — useful for debugging / logging */
  get timestamp(): Date {
    return new Date(this._timestamp);
  }
}
