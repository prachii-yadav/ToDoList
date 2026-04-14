import { ITaskData } from '../../types/task.types';

/**
 * Immutable snapshot of the full task list at a point in time.
 * Stores plain ITaskData (not Task instances) — safe to freeze and copy.
 * getState() returns a deep copy so callers can't mutate the saved snapshot.
 */
export class TaskMemento {
  private readonly _timestamp: Date;
  private readonly _state: ReadonlyArray<Readonly<ITaskData>>;

  constructor(state: ITaskData[]) {
    this._timestamp = new Date();

    // Deep-freeze each task so the snapshot can't be mutated externally
    this._state = Object.freeze(
      state.map(task => Object.freeze({ ...task }))
    );
  }

  /** Returns a shallow copy of each entry — unfreezes so callers can pass to Task.fromData(). */
  getState(): ITaskData[] {
    return this._state.map(task => ({ ...task }));
  }

  /** When this snapshot was taken. */
  get timestamp(): Date {
    return new Date(this._timestamp);
  }
}
