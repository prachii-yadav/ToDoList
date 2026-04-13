import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';

/**
 * Registers all task-related routes on an Express Router.
 *
 * ORDER MATTERS:
 *   Static paths (/undo, /redo, /history) MUST be declared before
 *   parameterised paths (/:id) — otherwise Express matches "undo" as an :id.
 */
export function createTaskRouter(controller: TaskController): Router {
  const router = Router();

  // ── Collection & static action routes (no :id param) ──────────────────────
  router.post('/',        controller.createTask);  // POST   /tasks
  router.get('/',         controller.getTasks);     // GET    /tasks[?status=]
  router.get('/history',  controller.getHistory);   // GET    /tasks/history
  router.post('/undo',    controller.undo);         // POST   /tasks/undo
  router.post('/redo',    controller.redo);         // POST   /tasks/redo

  // ── Resource routes (:id param — must come AFTER static paths) ────────────
  router.get('/:id',            controller.getTaskById);  // GET    /tasks/:id
  router.patch('/:id/complete', controller.completeTask); // PATCH  /tasks/:id/complete
  router.delete('/:id',         controller.deleteTask);   // DELETE /tasks/:id

  return router;
}
