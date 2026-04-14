# Personal To-Do List

A full-stack task manager built with **Node.js / Express / MongoDB** on the backend and **React / TypeScript / Vite** on the frontend. The project demonstrates production-quality code through layered architecture, classic design patterns, strict validation at every boundary, structured logging, and graceful error handling.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js 20 + TypeScript |
| HTTP framework | Express 5 |
| Database | MongoDB via Mongoose 9 |
| Validation | Zod v4 |
| Logging | Winston |
| Frontend | React 19 + TypeScript |
| Build tool | Vite 8 |
| HTTP client | Axios |

---

## Features

- Create tasks with description, priority (low / medium / high), optional due date, and tags
- Mark tasks as completed
- Delete tasks
- **Undo / Redo** — restore any previous state (up to 50 steps, backed by the Memento pattern)
- Filter by status, priority, tag, or keyword search
- Sort by creation date, due date, or priority
- Pagination (configurable page size, max 100)
- Request ID tracing across every log line and error response
- Graceful shutdown — drains connections before exit

---

## Project Structure

```
ToDoList/
├── server/                  # Express API
│   └── src/
│       ├── app.ts           # Entry point, DI wiring, graceful shutdown
│       ├── controllers/     # HTTP boundary — parse → delegate → respond
│       ├── services/        # Business logic
│       ├── repositories/    # Data access interface + MongoDB implementation
│       ├── models/          # Task domain class
│       ├── patterns/
│       │   ├── builder/     # TaskBuilder (Creational pattern)
│       │   └── memento/     # TaskMemento + TaskCaretaker (Behavioural pattern)
│       ├── middleware/      # Request logger, sanitizer, global error handler
│       ├── validators/      # Zod schemas for all request shapes
│       ├── utils/           # Winston logger, AppError hierarchy
│       ├── types/           # Shared enums and interfaces
│       └── db/              # Mongoose connection + schema
└── client/                  # React SPA
    └── src/
        ├── App.tsx          # Root component, action wiring
        ├── api/             # Axios wrapper for all API calls
        ├── hooks/           # useTasks (data + mutations), useToast
        ├── components/      # TaskInput, TaskList, TaskItem,
        │                    # FilterControls, UndoRedoControls, ToastContainer
        └── types/           # Frontend task interfaces (mirrors backend shapes)
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- MongoDB running locally (default: `mongodb://127.0.0.1:27017/todolist`)

### Server

```bash
cd server
cp .env.example .env      # set MONGO_URI, PORT, CLIENT_ORIGIN, LOG_LEVEL
npm install
npm run dev               # ts-node with nodemon watch
```

### Client

```bash
cd client
cp .env.example .env      # set VITE_API_URL (default: http://localhost:3000)
npm install
npm run dev               # Vite dev server on http://localhost:5173
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API index — lists all endpoints |
| `GET` | `/health` | Uptime + memory |
| `POST` | `/tasks` | Create task |
| `GET` | `/tasks` | List tasks (filter + sort + paginate) |
| `GET` | `/tasks/:id` | Get task by UUID |
| `PATCH` | `/tasks/:id/complete` | Mark task completed |
| `DELETE` | `/tasks/:id` | Delete task |
| `POST` | `/tasks/undo` | Undo last mutation |
| `POST` | `/tasks/redo` | Redo last undone mutation |
| `GET` | `/tasks/history` | Undo/redo availability |

### Query parameters for `GET /tasks`

| Param | Type | Description |
|-------|------|-------------|
| `status` | `pending \| completed` | Filter by status |
| `priority` | `low \| medium \| high` | Filter by priority |
| `tag` | string | Filter by tag (case-insensitive exact match) |
| `search` | string | Keyword search in description |
| `sortBy` | `createdAt \| dueDate \| priority` | Sort field |
| `sortOrder` | `asc \| desc` | Sort direction |
| `page` | number | Page number (default 1) |
| `limit` | number | Page size (default 20, max 100) |

---

## Design Patterns

| Pattern | Category | Where |
|---------|----------|-------|
| **Builder** | Creational | `TaskBuilder` constructs validated Task objects fluently |
| **Memento** | Behavioural | `TaskMemento` + `TaskCaretaker` power undo/redo |
| **Repository** | Structural | `ITaskRepository` interface decouples service from MongoDB |

---

## Design Principles

- **Single Responsibility** — each class has one reason to change (controller parses HTTP, service owns logic, repository owns persistence)
- **Open/Closed** — new HTTP error types extend `AppError`; the error middleware needs no modification
- **Dependency Inversion** — `TaskService` depends on `ITaskRepository`, not on `MongoTaskRepository`
- **Defensive programming** — prototype-pollution keys stripped before validation; all Date objects are deep-copied on read to prevent external mutation
- **Validation at every boundary** — Zod schemas on HTTP input, builder guards on domain construction, model methods guard state transitions
