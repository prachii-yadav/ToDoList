import { TaskMemento } from './task.memento';
import { ITaskData } from '../../types/task.types';
import logger from '../../utils/logger';

/**
 * TaskCaretaker — Memento Pattern: the history manager.
 *
 * RESPONSIBILITY (Single Responsibility Principle):
 *   Manages two stacks of snapshots — undoStack and redoStack.
 *   Does NOT know what a Task is. Only stores and retrieves Mementos.
 *
 * UNDO / REDO LIFECYCLE:
 *
 *   Before a mutating action (add / complete / delete):
 *     1. Call saveSnapshot(currentState)  →  push to undoStack, clear redoStack
 *     2. Perform the action
 *
 *   Undo:
 *     1. Push currentState to redoStack
 *     2. Pop from undoStack → restore that state
 *
 *   Redo:
 *     1. Push currentState to undoStack
 *     2. Pop from redoStack → restore that state
 *
 * LIMIT:
 *   History is capped at MAX_HISTORY entries to prevent unbounded memory growth.
 */
export class TaskCaretaker {
  private static readonly MAX_HISTORY = 50; // max undo steps

  private readonly undoStack: TaskMemento[] = [];
  private readonly redoStack: TaskMemento[] = [];

  // ── Save (called BEFORE every mutation) ──────────────────────────────────

  /**
   * Snapshot the current task list state before a mutation.
   * Clears the redo stack — once you take a new action, redo history is gone.
   *
   * @param currentState  The current list of task data (snapshot will be taken)
   */
  saveSnapshot(currentState: ITaskData[]): void {
    const memento = new TaskMemento(currentState);
    this.undoStack.push(memento);

    // Prevent unbounded memory growth
    if (this.undoStack.length > TaskCaretaker.MAX_HISTORY) {
      this.undoStack.shift(); // remove oldest entry from the front
    }

    // New action invalidates all redo history
    this.redoStack.length = 0;

    logger.debug(
      `Snapshot saved. Undo stack: ${this.undoStack.length}, Redo stack: 0`
    );
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  /**
   * Undo the last action.
   *
   * @param currentState  The task list state RIGHT NOW (saved to redoStack)
   * @returns             The previous state to restore
   * @throws              Error if there is nothing to undo
   */
  undo(currentState: ITaskData[]): ITaskData[] {
    if (this.undoStack.length === 0) {
      throw new Error('Nothing to undo.');
    }

    // Save current state so redo can come back to it
    this.redoStack.push(new TaskMemento(currentState));

    // Pop the last snapshot and return its state
    const previous = this.undoStack.pop()!;

    logger.debug(
      `Undo performed. Undo stack: ${this.undoStack.length}, Redo stack: ${this.redoStack.length}`
    );

    return previous.getState();
  }

  // ── Redo ──────────────────────────────────────────────────────────────────

  /**
   * Redo the last undone action.
   *
   * @param currentState  The task list state RIGHT NOW (saved back to undoStack)
   * @returns             The state to re-apply
   * @throws              Error if there is nothing to redo
   */
  redo(currentState: ITaskData[]): ITaskData[] {
    if (this.redoStack.length === 0) {
      throw new Error('Nothing to redo.');
    }

    // Save current state back to undo so undo can return here
    this.undoStack.push(new TaskMemento(currentState));

    // Pop the top of redo stack and return its state
    const next = this.redoStack.pop()!;

    logger.debug(
      `Redo performed. Undo stack: ${this.undoStack.length}, Redo stack: ${this.redoStack.length}`
    );

    return next.getState();
  }

  // ── Introspection (for API responses) ─────────────────────────────────────

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get undoCount(): number { return this.undoStack.length; }
  get redoCount(): number { return this.redoStack.length; }
}
