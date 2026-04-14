import { TaskMemento } from './task.memento';
import { ITaskData } from '../../types/task.types';
import logger from '../../utils/logger';

/**
 * Manages undo/redo history via two Memento stacks.
 * Knows nothing about Task internals — only stores and retrieves snapshots.
 * History is capped at MAX_HISTORY to prevent unbounded memory growth.
 */
export class TaskCaretaker {
  private static readonly MAX_HISTORY = 50;

  private readonly undoStack: TaskMemento[] = [];
  private readonly redoStack: TaskMemento[] = [];

  // ── Save (called BEFORE every mutation) ──────────────────────────────────

  /** Pushes a snapshot onto the undo stack and clears redo history. */
  saveSnapshot(currentState: ITaskData[]): void {
    const memento = new TaskMemento(currentState);
    this.undoStack.push(memento);

    if (this.undoStack.length > TaskCaretaker.MAX_HISTORY) {
      this.undoStack.shift();
    }

    this.redoStack.length = 0;

    logger.debug(
      `Snapshot saved. Undo stack: ${this.undoStack.length}, Redo stack: 0`
    );
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  /**
   * @param currentState  Saved to redoStack so redo can return here
   * @returns             The previous state to restore
   * @throws              Error if there is nothing to undo
   */
  undo(currentState: ITaskData[]): ITaskData[] {
    if (this.undoStack.length === 0) {
      throw new Error('Nothing to undo.');
    }

    this.redoStack.push(new TaskMemento(currentState));
    const previous = this.undoStack.pop()!;

    logger.debug(
      `Undo performed. Undo stack: ${this.undoStack.length}, Redo stack: ${this.redoStack.length}`
    );

    return previous.getState();
  }

  // ── Redo ──────────────────────────────────────────────────────────────────

  /**
   * @param currentState  Saved back to undoStack so undo can return here
   * @returns             The state to re-apply
   * @throws              Error if there is nothing to redo
   */
  redo(currentState: ITaskData[]): ITaskData[] {
    if (this.redoStack.length === 0) {
      throw new Error('Nothing to redo.');
    }

    this.undoStack.push(new TaskMemento(currentState));
    const next = this.redoStack.pop()!;

    logger.debug(
      `Redo performed. Undo stack: ${this.undoStack.length}, Redo stack: ${this.redoStack.length}`
    );

    return next.getState();
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get undoCount(): number { return this.undoStack.length; }
  get redoCount(): number { return this.redoStack.length; }
}
