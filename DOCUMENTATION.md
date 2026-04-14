# Architecture & Design Documentation

This document walks through every layer of the To-Do List codebase — the decisions taken, patterns chosen, and how the pieces connect.

---

## Table of Contents

1. [High-level Architecture](#1-high-level-architecture)
2. [Backend Layers](#2-backend-layers)
   - 2.1 [Entry Point & Dependency Injection](#21-entry-point--dependency-injection)
   - 2.2 [Domain Model — Task](#22-domain-model--task)
   - 2.3 [Type System](#23-type-system)
   - 2.4 [Builder Pattern — TaskBuilder](#24-builder-pattern--taskbuilder)
   - 2.5 [Memento Pattern — Undo/Redo](#25-memento-pattern--undoredo)
   - 2.6 [Repository Layer](#26-repository-layer)
   - 2.7 [Service Layer — TaskService](#27-service-layer--taskservice)
   - 2.8 [Controller Layer — TaskController](#28-controller-layer--taskcontroller)
   - 2.9 [Routes](#29-routes)
   - 2.10 [Middleware Pipeline](#210-middleware-pipeline)
   - 2.11 [Validation — Zod Schemas](#211-validation--zod-schemas)
   - 2.12 [Error Hierarchy](#212-error-hierarchy)
   - 2.13 [Logging](#213-logging)
   - 2.14 [Database Connection & Schema](#214-database-connection--schema)
3. [Frontend Layers](#3-frontend-layers)
   - 3.1 [Type Definitions](#31-type-definitions)
   - 3.2 [API Layer](#32-api-layer)
   - 3.3 [useTasks Hook](#33-usetasks-hook)
   - 3.4 [useToast Hook](#34-usetoast-hook)
   - 3.5 [Component Tree](#35-component-tree)
4. [Request Lifecycle — End to End](#4-request-lifecycle--end-to-end)
5. [Undo/Redo Lifecycle](#5-undoredo-lifecycle)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Key Design Decisions](#7-key-design-decisions)

---

## 1. High-level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Browser                           │
│  React SPA (Vite)                                       │
│  App → useTasks hook → api/tasks.ts (Axios)             │
└────────────────────────┬────────────────────────────────┘
                         │  HTTP  (JSON)
┌────────────────────────▼────────────────────────────────┐
│                   Express Server                        │
│                                                         │
│  Middleware pipeline                                    │
│  → requestLoggerMiddleware (attach request ID)          │
│  → compression                                          │
│  → express.json  (10kb body limit)                      │
│  → sanitizeMiddleware (strip prototype-pollution keys)  │
│                                                         │
│  Routes → TaskController                               │
│         → TaskService (business logic)                  │
│            → TaskBuilder      (Creational)              │
│            → TaskCaretaker    (Behavioural / Memento)   │
│            → ITaskRepository  (interface)               │
│               └─ MongoTaskRepository (implementation)   │
│                                                         │
│  errorMiddleware (global error handler, registered last)│
└────────────────────────┬────────────────────────────────┘
                         │  Mongoose
┌────────────────────────▼────────────────────────────────┐
│                     MongoDB                             │
│  Collection: tasks                                      │
│  Index on: id (UUID string, unique)                     │
└─────────────────────────────────────────────────────────┘
```

The architecture is a strict **layered** design. Each layer depends only on the layer directly below it through an interface. No layer reaches across (the controller never touches the repository; the repository never reads from the request object).

---

## 2. Backend Layers

### 2.1 Entry Point & Dependency Injection

**File:** [server/src/app.ts](server/src/app.ts)

`app.ts` is the composition root — the only place that knows which concrete classes are in use. It manually wires (constructs and connects) all dependencies:

```
MongoTaskRepository  ──┐
                        ├──► TaskService ──► TaskController ──► Router
TaskCaretaker        ──┘
```

This is **manual DI** (no container library). The benefit is full transparency: changing the database means swapping one line in `app.ts`; nothing else changes.

`app.ts` also registers the middleware pipeline in the correct order, mounts the task router, registers the global error handler **last** (Express requires this), and implements graceful shutdown:

- On `SIGTERM` or `SIGINT`, the HTTP server stops accepting new connections, then MongoDB is disconnected cleanly.
- A 10-second hard timeout forces exit if connections stall — standard practice for containerised deployments.
- `process.on('unhandledRejection')` catches any promise rejections that escape without a handler, logs them, and exits so the process manager (PM2, Docker, k8s) can restart cleanly rather than letting the process run in a partially-broken state.

---

### 2.2 Domain Model — Task

**File:** [server/src/models/task.model.ts](server/src/models/task.model.ts)

`Task` is the core **domain object**. Every field is private. External code can only read state through read-only getters and change state through the two domain methods: `complete()` and `updateDescription()`.

Key design choices:

| Choice | Reason |
|--------|--------|
| All fields private | Prevents accidental mutation from outside the class |
| Defensive copies on every getter and in the constructor | A caller holding a reference to a tag array or Date cannot corrupt the Task's internal state |
| `complete()` is idempotent | Calling it twice is a no-op — services don't need to guard against double-completion |
| `toData()` returns a plain `ITaskData` snapshot | Serialization is the Task's responsibility; the service/controller never access private fields directly |
| `static fromData(data)` reconstructs a Task | Used by the Memento system: a saved snapshot (plain object) becomes a live Task again without going through the builder |
| Constructor is not exported (`/** Not exported */`) | Forces all new Tasks through `TaskBuilder`, which validates and assigns a UUID |

---

### 2.3 Type System

**File:** [server/src/types/task.types.ts](server/src/types/task.types.ts)

All shared types are declared in one file:

- `TaskPriority` and `TaskStatus` — string enums used in Mongoose schemas, Zod schemas, and domain code simultaneously, so there is a single source of truth
- `ITaskData` — the read-only plain-object snapshot that flows between layers (service returns it, controller serializes it, Memento stores it)
- `ITaskCreateInput` — what the builder accepts (not the HTTP body shape — that is Zod's job)
- `ITaskFilter` / `IPaginatedResult<T>` — filter and response contracts between service and repository

All layers import from this file. This prevents drift between layers.

---

### 2.4 Builder Pattern — TaskBuilder

**File:** [server/src/patterns/builder/task.builder.ts](server/src/patterns/builder/task.builder.ts)

**Category:** Creational design pattern.

**Purpose:** Separate object construction from its representation. A `Task` has required fields (description) and several optional fields (priority, tags, dueDate). Without a builder, every call site would have to pass `null` for optional fields, or there would be many overloaded constructors.

**Fluent interface:**
```typescript
const task = new TaskBuilder('Buy groceries')
  .withPriority(TaskPriority.HIGH)
  .withTags(['shopping', 'urgent'])
  .withDueDate(new Date('2026-05-01'))
  .build();
```

**Validation happens here, not in the constructor:**

| Validation | Reason |
|------------|--------|
| Description cannot be blank (after trim) | Guards against whitespace-only input that passes a length check |
| Due date cannot be in the past (day granularity) | Business rule — you cannot schedule a task for yesterday |
| Tags must be non-empty strings; duplicates removed (case-insensitive) | Clean data before persistence |

UUID generation (`uuidv4()`) is also the builder's responsibility — the Task class itself does not know how IDs are assigned.

---

### 2.5 Memento Pattern — Undo/Redo

**Files:**
- [server/src/patterns/memento/task.memento.ts](server/src/patterns/memento/task.memento.ts)
- [server/src/patterns/memento/task.caretaker.ts](server/src/patterns/memento/task.caretaker.ts)

**Category:** Behavioural design pattern.

**Purpose:** Capture and restore previous state without exposing internal implementation details.

The Memento pattern involves three roles:

| Role | Class | Responsibility |
|------|-------|----------------|
| Originator | `TaskService` | Creates snapshots; applies restored state |
| Memento | `TaskMemento` | Immutable state snapshot (`Object.freeze`) |
| Caretaker | `TaskCaretaker` | Manages undo/redo stacks; knows nothing about Task internals |

**How snapshots are stored:**

`TaskMemento` stores an array of `ITaskData` (plain objects, not class instances). Using `Object.freeze` at two levels (the array itself, and each element object) prevents any code holding a reference to an old snapshot from accidentally mutating it.

**Undo/Redo stacks:**

```
Before mutation:          saveSnapshot(currentState)  → undoStack.push, redoStack.clear

Undo:  redoStack.push(currentState)  ← undoStack.pop  → returns previousState
Redo:  undoStack.push(currentState)  ← redoStack.pop  → returns nextState
```

`MAX_HISTORY = 50` caps memory usage. The oldest snapshot is discarded (`undoStack.shift()`) when the limit is exceeded.

**Persistence of undo/redo:**

Because the Caretaker is instantiated once in `app.ts` and injected into `TaskService`, history survives across multiple HTTP requests within a server session. Undo/redo state is **in-memory only** — it is not persisted to MongoDB and resets on server restart. This is an acknowledged limitation for this scope.

---

### 2.6 Repository Layer

**Files:**
- [server/src/repositories/task.repository.ts](server/src/repositories/task.repository.ts) — interface
- [server/src/repositories/task.repository.mongo.ts](server/src/repositories/task.repository.mongo.ts) — implementation

**Category:** Structural pattern (Repository / Data Access Object).

`ITaskRepository` is an interface that declares what operations the service needs:

```typescript
interface ITaskRepository {
  save(task: Task): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  findByFilter(filter: ITaskFilter): Promise<IPaginatedResult<Task>>;
  delete(id: string): Promise<boolean>;
  replaceAll(tasks: Task[]): Promise<void>;
}
```

`TaskService` depends on this interface — not on any concrete class. This is the **Dependency Inversion Principle** in practice. To swap MongoDB for PostgreSQL, only `MongoTaskRepository` changes; the service is untouched.

**MongoTaskRepository highlights:**

- `save()` uses **upsert** (`findOneAndUpdate` with `{ upsert: true }`) — insert-or-update in one operation
- `findByFilter()` runs count and data fetch with **`Promise.all`** to halve database round-trips
- Priority sort is handled **in-memory** after fetch (not via MongoDB aggregation pipeline) because MongoDB has no native enum-weight ordering — a simple weight map avoids pipeline complexity for this scale
- `replaceAll()` — used exclusively by undo/redo — does a `deleteMany` then `insertMany`. This is not atomic; for a multi-user production app a transaction would be required. This trade-off is documented in the code comment
- `docToTask()` bridges the Mongoose document shape back to the domain `Task` via `Task.fromData()`, keeping the MongoDB schema fully isolated from the domain model

---

### 2.7 Service Layer — TaskService

**File:** [server/src/services/task.service.ts](server/src/services/task.service.ts)

`TaskService` contains all business logic and is the only place that knows about the Memento pattern. It has no knowledge of HTTP (no `Request`, no `Response`).

**Every mutation follows this sequence:**

```
1. Validate the action is possible (e.g. task exists)
2. saveSnapshot(await _currentState())   ← snapshot BEFORE the change
3. Perform the mutation
4. Persist via repository
5. Return ITaskData to the controller
```

**Why snapshot before, not after?**

When the user hits Undo, they want to go back to the state *before* the last action. If we snapshotted after, the undo would restore to the state right after the action — which is the current state. Snapshotting before is the canonical Memento approach.

**`_currentState()`** calls `repository.findAll()` to get a consistent read from the database each time, rather than maintaining an in-memory mirror that could drift.

**Read operations (`getTasks`, `getTaskById`)** do not take snapshots — reads are non-destructive.

---

### 2.8 Controller Layer — TaskController

**File:** [server/src/controllers/task.controller.ts](server/src/controllers/task.controller.ts)

The controller is the HTTP boundary. Its only jobs are:

1. Parse the request through a Zod schema (validates and types the input)
2. Call the appropriate service method
3. Serialize the response as JSON

All methods are arrow function class properties (not prototype methods). This avoids the JavaScript `this` binding problem when Express calls them as callbacks — `this` always refers to the `TaskController` instance.

All errors propagate via `next(err)` to the global error middleware — the controller never calls `res.status(500)` directly.

---

### 2.9 Routes

**File:** [server/src/routes/task.routes.ts](server/src/routes/task.routes.ts)

A factory function `createTaskRouter(controller)` builds the router, keeping route registration separate from the controller class. This makes the route table easy to read at a glance.

**Critical ordering note:** Static paths (`/undo`, `/redo`, `/history`) are registered before parameterised paths (`/:id`). If they were after, Express would match the string `"undo"` as a UUID value for `:id`, causing a Zod UUID validation error instead of calling the correct handler.

---

### 2.10 Middleware Pipeline

Middleware is registered in `app.ts` in deliberate order:

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `cors` | Allow requests from the Vite dev server (configurable per environment) |
| 2 | `requestLoggerMiddleware` | Attach/echo request ID; log request in, response out with duration |
| 3 | `compression` | gzip all responses |
| 4 | `express.json({ limit: '10kb' })` | Parse JSON body; reject bodies over 10kb (prevents large-body DoS) |
| 5 | `sanitizeMiddleware` | Strip `__proto__`, `constructor`, `prototype` keys (prototype-pollution defence) |
| — | `errorMiddleware` | Registered **last** — catches all errors propagated via `next(err)` |

**requestLoggerMiddleware** ([server/src/middleware/request-logger.middleware.ts](server/src/middleware/request-logger.middleware.ts)):
- Honours an incoming `x-request-id` header (set by a reverse proxy like Nginx) so the ID is consistent end-to-end
- Generates a fresh UUID if none is provided
- Attaches the ID to the request object and echoes it back in the response header
- Logs the response line on the `res.finish` event — only then is the status code and duration accurate

**sanitizeMiddleware** ([server/src/middleware/sanitize.middleware.ts](server/src/middleware/sanitize.middleware.ts)):
- Walks the request body recursively and removes the three classic prototype-pollution keys
- Logs a warning if any are found (indicating an attack or misconfigured client)
- Acts as defence-in-depth: Zod's strict object parsing would also reject unknown keys, but stripping them here means they never reach the validator at all

---

### 2.11 Validation — Zod Schemas

**File:** [server/src/validators/task.validator.ts](server/src/validators/task.validator.ts)

Three schemas cover all HTTP inputs:

| Schema | Used for |
|--------|---------|
| `createTaskSchema` | `POST /tasks` body |
| `filterTasksSchema` | `GET /tasks` query string |
| `taskIdSchema` | Route param `:id` on all resource routes |

**Zod's `z.infer<>` derives TypeScript types from the schemas.** The inferred types (`CreateTaskInput`, `FilterTasksInput`) are what the service accepts — there is no separate manual type to keep in sync.

**Query string coercion:** Query string values are always strings. `filterTasksSchema` uses `.transform(Number).pipe(z.number().int().min(1))` to parse `page` and `limit` into numbers without silent coercion surprises.

**Zod v4 enum syntax:** `z.enum(Object.values(TaskPriority) as [TaskPriority, ...TaskPriority[]])` derives the enum options from the TypeScript enum at compile time — adding a new priority level updates both the type and the validation in one place.

---

### 2.12 Error Hierarchy

**File:** [server/src/utils/app-error.ts](server/src/utils/app-error.ts)

```
Error
└── AppError (abstract, isOperational = true)
    ├── ValidationError    (400)
    ├── NotFoundError      (404)
    ├── ConflictError      (409)  ← reserved
    └── UnprocessableError (422)  ← reserved
```

**Open/Closed Principle:** The error middleware does a single `instanceof AppError` check and uses `err.statusCode`. Adding a new error type (e.g. `UnauthorizedError` 401) is done purely by extending `AppError` — the middleware needs zero changes.

`isOperational = true` marks an error as expected (a known failure mode, not a bug). An unexpected error (e.g. a null pointer) will not be an `AppError` instance — the middleware correctly gives it a generic 500 and logs the full stack trace, while operational errors get a `warn` log only.

---

### 2.13 Logging

**File:** [server/src/utils/logger.ts](server/src/utils/logger.ts)

Winston is configured as a singleton and used everywhere via import. Log format:

```
[2026-04-14 10:23:45] info: [reqId-abc] --> POST /tasks
[2026-04-14 10:23:45] info: [reqId-abc] <-- POST /tasks 201 38ms
```

- **Timestamps** on every line (aids log aggregator queries)
- **Colorized** output in development
- **Stack traces** captured via `winston.format.errors({ stack: true })`
- **Log level** is configurable via `LOG_LEVEL` env var (defaults to `info`; set to `debug` to see memento stack sizes)

The request ID threaded through every log line allows all activity for a single HTTP request to be correlated in tools like Datadog, Grafana Loki, or CloudWatch.

---

### 2.14 Database Connection & Schema

**Files:**
- [server/src/db/connection.ts](server/src/db/connection.ts)
- [server/src/db/task.schema.ts](server/src/db/task.schema.ts)

`connectDB()` is called in `app.ts` before the HTTP server starts listening, ensuring the database is ready before the first request arrives.

**Schema decisions:**

| Decision | Reason |
|----------|--------|
| Explicit `id: String` (UUID) instead of relying on `_id` (ObjectId) | API responses use string UUIDs consistently; Memento can restore tasks by their original ID without an ObjectId round-trip |
| `toJSON.transform` deletes `_id` and `__v` | Keeps API responses clean — clients only see `id` |
| `timestamps: true` | Mongoose manages `createdAt` / `updatedAt` automatically; `save()` in the repository overrides `updatedAt` explicitly when restoring a Memento snapshot to preserve historical timestamps |
| `unique: true, index: true` on `id` | Fast lookup by UUID; prevents duplicate documents |

---

## 3. Frontend Layers

### 3.1 Type Definitions

**File:** [client/src/types/task.ts](client/src/types/task.ts)

The frontend mirrors the backend's `ITaskData` / `ITaskFilter` shapes as plain TypeScript interfaces. There is intentional duplication rather than sharing a package — the frontend and backend can evolve independently, and the serialization boundary (JSON over HTTP) is the contract, not shared code.

`dueDate` is typed as `string | null` on the frontend (ISO string from JSON), not as `Date` — keeping it as a string avoids timezone conversion bugs at the deserialization boundary.

---

### 3.2 API Layer

**File:** [client/src/api/tasks.ts](client/src/api/tasks.ts)

A single Axios instance is configured with `baseURL` read from the `VITE_API_URL` environment variable. All API functions are thin wrappers that:

1. Strip `undefined` values from query params (prevents `?status=undefined` in the URL)
2. Call the correct endpoint
3. Extract the typed payload from the response

The API layer has no state and no side effects beyond the HTTP call. All state lives in the hook layer.

---

### 3.3 useTasks Hook

**File:** [client/src/hooks/useTasks.ts](client/src/hooks/useTasks.ts)

`useTasks` is the single source of truth for the entire application's task state. It encapsulates:

- **State:** `tasks`, `pagination`, `history`, `filter`, `loading`, `mutating`, `error`
- **Side effects:** `fetchTasks` re-runs whenever `filter` changes (via `useEffect`)
- **Mutation wrapper (`withMutation`):** A reusable higher-order function that sets `mutating = true`, runs any async operation, resets state on completion, and extracts a human-readable error on failure. This prevents code duplication across the five mutating actions
- **In-flight guard:** A `useRef` flag (not `useState`) prevents concurrent mutations if a user clicks quickly — the ref is synchronous so it cannot be stale between renders

**Error extraction (`extractMessage`):** Handles the three error shapes the backend can return:
1. Zod validation issues array (`issues[].field + message`)
2. Plain `error` string from `AppError`
3. Network errors (server not running)

All actions return `boolean` — `true` on success, `false` on error. `App.tsx` uses this to decide whether to show a success toast.

---

### 3.4 useToast Hook

**File:** [client/src/hooks/useToast.ts](client/src/hooks/useToast.ts)

Manages an array of toast notifications. Each toast auto-dismisses after a timeout. The hook exposes `showToast(message, type)` and `dismiss(id)`.

---

### 3.5 Component Tree

```
App
├── header
│   ├── <h1> title
│   └── UndoRedoControls   — driven by history state from useTasks
├── TaskInput              — controlled form; client-side validation mirrors Zod constraints
├── FilterControls         — purely controlled (no local state); calls setFilter on change
├── error banner           — dismissible; shown when useTasks.error is non-null
├── TaskList
│   └── TaskItem[]         — confirmation popup before complete/delete actions
├── pagination summary
└── ToastContainer         — absolute-positioned toast stack
```

**TaskInput** validates locally (description length, tag count, tag length) before calling `onAdd`. This mirrors the backend Zod constraints, giving the user instant feedback without a network round-trip. On submit, it converts the `<input type="date">` value (`YYYY-MM-DD`) to a full ISO 8601 string (`YYYY-MM-DDT00:00:00.000Z`) that the backend Zod schema requires.

**TaskItem** uses a local `pending` state to implement a two-step confirmation for both complete and delete actions — preventing accidental data loss.

**FilterControls** is a **controlled component** with no local state. Every change propagates up to `useTasks` via `onChange`, which triggers a data re-fetch. Page is reset to 1 on every filter change to prevent being on a page that no longer exists after filtering.

**UndoRedoControls** shows badge counts (`undoCount`, `redoCount`) so the user knows how many steps are available before clicking. Buttons are disabled when `canUndo` / `canRedo` are false or when a mutation is in flight.

---

## 4. Request Lifecycle — End to End

Example: **Create a task** (`POST /tasks`)

```
1. User fills the form and clicks "Add"
   TaskInput.handleSubmit() validates locally → calls props.onAdd(payload)

2. App.handleAdd() calls useTasks.addTask(payload)

3. useTasks.withMutation() sets mutating=true

4. api.createTask(payload) — Axios POST /tasks with JSON body

5. Express receives request:
   a. requestLoggerMiddleware: attach request ID, log "-->"
   b. compression: no-op on request
   c. express.json: parse body
   d. sanitizeMiddleware: walk body, remove dangerous keys

6. Router matches POST /tasks → TaskController.createTask()

7. Controller: createTaskSchema.parse(req.body)
   - If invalid → ZodError thrown → next(err) → errorMiddleware → 400 JSON

8. Controller calls taskService.addTask(input)

9. TaskService:
   a. caretaker.saveSnapshot(currentState)  ← snapshot before mutation
   b. new TaskBuilder(description)
      .withPriority(...)
      .withTags(...)
      .withDueDate(...)
      .build()                             ← validation + UUID generation
   c. taskRepository.save(task)            ← upsert to MongoDB

10. Controller: res.status(201).json({ success: true, data: task.toData() })

11. requestLoggerMiddleware 'finish' event: log "<-- 201 38ms"

12. Axios receives 201 response

13. useTasks: fetchTasks(filter) + fetchHistory() run in parallel

14. React re-renders: new task appears in the list, success toast shown
```

---

## 5. Undo/Redo Lifecycle

Example: **Undo** after creating a task

```
State before create:   []          (undo stack: empty)
After create:          [TaskA]     (undo stack: [ [] ])
                                                  ↑ snapshot taken before TaskA was added

User clicks "Undo"

1. App.handleUndo() → useTasks.undoAction()

2. api.undoAction() — Axios POST /tasks/undo

3. TaskController.undo() → taskService.undo()

4. TaskService.undo():
   a. currentState = [TaskA]  (from repository.findAll())
   b. caretaker.undo([TaskA]):
      - redoStack.push( new TaskMemento([TaskA]) )
      - previousState = undoStack.pop() = TaskMemento([])
      - return [].getState() = []
   c. repository.replaceAll([])  ← deleteMany + insertMany([])

5. Controller responds: { success: true, data: [], history: { canUndo: false, canRedo: true, ... } }

6. useTasks: setHistory(result.history), fetchTasks()

7. UI: task list empty, Undo disabled, Redo enabled with badge "1"

User clicks "Redo"

1. api.redoAction() → taskService.redo()

2. TaskService.redo():
   a. currentState = []
   b. caretaker.redo([]):
      - undoStack.push( new TaskMemento([]) )
      - nextState = redoStack.pop() = TaskMemento([TaskA])
      - return [TaskA].getState()
   c. repository.replaceAll([TaskA])

3. UI: TaskA reappears, Undo enabled, Redo disabled
```

---

## 6. Cross-Cutting Concerns

### Security

| Concern | Mitigation |
|---------|-----------|
| Large request bodies | `express.json({ limit: '10kb' })` — rejects oversized bodies before they reach any handler |
| Prototype pollution | `sanitizeMiddleware` strips `__proto__`, `constructor`, `prototype` keys from all request bodies |
| Input validation | Zod schemas at the HTTP boundary; builder validation at domain construction; model methods guard state transitions |
| CORS | Whitelist-only: `CLIENT_ORIGIN` env var; only GET/POST/PATCH/DELETE allowed |
| UUID enforcement | Zod `z.uuid()` on all `:id` route parameters — non-UUID strings are rejected before the service is called |

### Performance

| Concern | Approach |
|---------|---------|
| Response size | `compression` middleware gzips all responses |
| Database round-trips | `Promise.all` for count + data in `findByFilter` |
| Pagination | All list queries are paginated (default 20, max 100) — never fetches unbounded data |
| Concurrent mutations | `mutatingRef` in `useTasks` drops duplicate mutation calls when one is already in flight |

### Observability

| Signal | Detail |
|--------|--------|
| Structured logs | Winston with timestamps, levels, and full stack traces on errors |
| Request tracing | Every log line in a request includes the request ID |
| Health endpoint | `GET /health` exposes uptime and heap memory for monitoring |
| Undo/redo introspection | `GET /tasks/history` lets the client always know the exact state of the history stacks |

---

## 7. Key Design Decisions

**Why manual DI instead of a container?**  
For a project of this scope, a DI container adds indirection with no benefit. Manual wiring in `app.ts` is transparent and grep-able — you can trace the entire object graph in one file.

**Why UUIDs instead of MongoDB ObjectIds as the public ID?**  
ObjectIds are MongoDB-specific. UUID strings are database-agnostic and consistent across serialization. The Memento system restores tasks by ID — using UUIDs means a restored task's ID survives a database swap without any adaptation layer.

**Why snapshot the whole task list, not just the changed task?**  
The Memento pattern's strength is simplicity: the caretaker knows nothing about what changed. Snapshotting the full list means undo/redo works correctly for any combination of creates, completes, and deletes without the caretaker needing task-diff logic. At the scale of a personal to-do list (tens to hundreds of tasks), the overhead is negligible.

**Why in-memory priority sort instead of a MongoDB aggregation pipeline?**  
MongoDB does not have a native concept of enum value ordering. An aggregation pipeline `$addFields` + `$sort` would add complexity and a new query shape for a marginal gain at this scale. The current approach — fetch in stable `createdAt` order, sort in JavaScript using a weight map — is correct, readable, and fast enough.

**Why does the frontend duplicate the backend types?**  
The serialization boundary is JSON over HTTP — the types on each side describe what crosses that boundary. Sharing a npm workspace package would couple the frontend and backend build pipelines. For a small project the duplication is minimal; if the API grows, a shared types package becomes worthwhile.

**Why client-side validation that mirrors the backend Zod rules?**  
Instant feedback without a network round-trip. The two sets of rules are deliberately in sync (max description length, max tags count, etc.) but independently expressed — the frontend uses plain `if` statements, the backend uses Zod. Keeping both is the defence-in-depth approach: the backend always validates regardless of what the frontend does.
