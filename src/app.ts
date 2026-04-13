import express, { Application } from 'express';
import compression from 'compression';
import logger from './utils/logger';
import { InMemoryTaskRepository } from './repositories/task.repository';
import { TaskCaretaker } from './patterns/memento/task.caretaker';
import { TaskService } from './services/task.service';
import { TaskController } from './controllers/task.controller';
import { createTaskRouter } from './routes/task.routes';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';
import { sanitizeMiddleware } from './middleware/sanitize.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app: Application = express();
const PORT = process.env['PORT'] ?? 3000;

// ── Dependency Wiring (manual DI) ────────────────────────────────────────────
const taskRepository = new InMemoryTaskRepository();
const taskCaretaker  = new TaskCaretaker();
const taskService    = new TaskService(taskRepository, taskCaretaker);
const taskController = new TaskController(taskService);

// ── Global Middleware (order matters) ─────────────────────────────────────────
app.use(requestLoggerMiddleware);          // 1. log every request + attach request ID
app.use(compression());                   // 2. gzip responses
app.use(express.json({ limit: '10kb' })); // 3. parse JSON — hard limit prevents large-body attacks
app.use(sanitizeMiddleware);              // 4. strip prototype-pollution keys from body

// ── Routes ───────────────────────────────────────────────────────────────────
// ── Root — API index ─────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    name:    'Personal To-Do List API',
    version: '1.0.0',
    endpoints: {
      health:   'GET  /health',
      tasks: [
        'POST   /tasks                  — create task',
        'GET    /tasks                  — list tasks (filter + sort + paginate)',
        'GET    /tasks/:id              — get task by ID',
        'PATCH  /tasks/:id/complete     — mark task completed',
        'DELETE /tasks/:id              — delete task',
        'POST   /tasks/undo             — undo last action',
        'POST   /tasks/redo             — redo last undone action',
        'GET    /tasks/history          — undo/redo stack info',
      ],
      queryParams: {
        status:    'pending | completed',
        priority:  'low | medium | high',
        tag:       'string',
        search:    'string (description keyword)',
        sortBy:    'createdAt | dueDate | priority',
        sortOrder: 'asc | desc',
        page:      'number (default: 1)',
        limit:     'number (default: 20, max: 100)',
      },
    },
  });
});

app.get('/health', (_req, res) => {
  const uptime  = process.uptime();
  const mem     = process.memoryUsage();
  res.status(200).json({
    status:  'ok',
    uptime:  `${Math.floor(uptime)}s`,
    memory: {
      heapUsed:  `${Math.round(mem.heapUsed  / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
  });
});

app.use('/tasks', createTaskRouter(taskController));

// ── Global Error Handler (must be registered last) ───────────────────────────
app.use(errorMiddleware);

// ── Start Server ──────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`Server started on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
// Stop accepting new connections, finish in-flight requests, then exit.
// This prevents data corruption and ensures clients receive responses to
// in-flight requests when the process is restarted (e.g. by a deploy or k8s).
function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('All connections closed. Process exiting.');
    process.exit(0);
  });

  // Force exit after 10s if connections are still open
  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections — log and exit so the process manager
// (PM2, Docker, k8s) can restart cleanly rather than running in a broken state
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason : String(reason));
  process.exit(1);
});

export default app;
