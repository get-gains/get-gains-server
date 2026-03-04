# Standalone Workout Feature

> **Status**: ✅ Documented  
> **Last Updated**: March 2026  
> **Covers**: Personal Exercises, Personal Routines, Personal Programs, Self-Assignment, Today's Workout, Standalone Sessions, Weekly Stats

---

## Overview

### Purpose

The Standalone Workout feature provides a **subscription-free, coach-free** workout system for individual users. It mirrors the coach-assigned workout flow but with user-owned resources:

- **Personal Exercises**: Create, browse, update, and delete user-owned exercises (with public visibility option)
- **Personal Routines**: Build custom routines with exercises and prescribed sets/reps
- **Personal Programs**: Organize routines into multi-day training programs
- **Self-Assignment**: Activate/deactivate personal programs (only one active at a time)
- **Today's Workout**: Day-cycling logic to resolve the current routine from the active program
- **Standalone Sessions**: Start, track, and complete workout sessions without a subscription
- **Weekly Stats**: Aggregated workout statistics scoped to all user sessions

### Scope

**This document covers:**

- Personal exercise CRUD with ownership enforcement and duplicate-name checking
- Personal routine CRUD with exercise junction management
- Personal program CRUD with routine-day assignment
- Program activation/deactivation (self-assignment via `AssignedProgram`)
- Day-cycling "today's workout" resolution from active standalone program
- Standalone session lifecycle (start → log sets via `/api/workout/sets` → complete)
- Weekly stats (workouts completed, total minutes, streak)

**Not included:**

- Set logging endpoints (uses existing `/api/workout/sets`, `/api/workout/sets/sync` — see [WORKOUT.md](WORKOUT.md))
- Coach-assigned programs and coach-owned routines (see [PROGRAM.md](PROGRAM.md))
- Subscription/payment flows (see [SUBSCRIPTION.md](SUBSCRIPTION.md))

### Dependencies

| Package          | Version | Purpose             |
| ---------------- | ------- | ------------------- |
| `@prisma/client` | ^7.2.0  | Database operations |
| `zod`            | ^4.3.5  | Request validation  |
| `express`        | ^5.2.1  | HTTP routing        |

### Entry Points

| File                                        | Description                                    |
| ------------------------------------------- | ---------------------------------------------- |
| `/src/routes/standalone.routes.ts`          | Route definitions for all standalone endpoints |
| `/src/controllers/standalone.controller.ts` | Business logic for standalone operations       |
| `/src/schemas/standalone.schema.ts`         | Zod validation schemas                         |
| `/prisma/schema.prisma`                     | Database models (shared with coach flow)       |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATION                              │
│                         (Flutter Mobile App)                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS SERVER                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     STANDALONE ROUTES                            │   │
│  │  /api/standalone/exercises, /routines, /programs,               │   │
│  │  /today, /sessions, /stats/weekly                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐     │
│  │  VALIDATION  │  │  AUTH MIDDLEWARE  │  │  requireAppUser      │     │
│  │  (Zod)       │  │  (Supabase JWT)  │  │  (no coach/sub req)  │     │
│  └──────────────┘  └──────────────────┘  └──────────────────────┘     │
│                              │                                         │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   STANDALONE CONTROLLER                          │   │
│  │  Personal Exercises · Personal Routines · Personal Programs     │   │
│  │  Self-Assignment · Today's Workout · Sessions · Weekly Stats    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                         │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PRISMA CLIENT                               │   │
│  │  Exercise, Routine, RoutineExercise, Program, ProgramRoutine,   │   │
│  │  AssignedProgram, WorkoutSession, PerformedSet                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────┐
                         │   POSTGRESQL    │
                         │   (Database)    │
                         └─────────────────┘
```

### Key Design Decisions

- **Shared Prisma models**: Personal exercises use `Exercise.userId`, personal routines use `Routine.userId`, personal programs use `Program.userId` — the same models as coach-owned resources but scoped by `userId` instead of `coachId`.
- **No subscription/coach middleware**: All routes use only `authenticateSupabaseUser` + `requireAppUser`. No `requireCoach` or `requireSubscription` guards.
- **Ownership enforcement**: Every mutating operation verifies the resource's `userId` matches the authenticated user before proceeding.
- **Self-assignment isolation**: Activating a standalone program only deactivates other user-owned program assignments — coach-assigned programs are left untouched.
- **Day-cycling parity**: The today's workout logic uses the same day-cycling algorithm as the coach-assigned version (`(daysSinceStart % totalCycleDays) + 1`).

---

## API Endpoints

### Personal Exercise Endpoints

| Method   | Endpoint                                | Description                           | Auth       |
| -------- | --------------------------------------- | ------------------------------------- | ---------- |
| `POST`   | `/api/standalone/exercises`             | Create a personal exercise            | Yes (User) |
| `GET`    | `/api/standalone/exercises`             | List user's exercises + public        | Yes (User) |
| `PATCH`  | `/api/standalone/exercises/:exerciseId` | Update own exercise (ownership check) | Yes (User) |
| `DELETE` | `/api/standalone/exercises/:exerciseId` | Delete own exercise (ownership check) | Yes (User) |

**GET Query Parameters**: `muscleGroup`, `search`, `limit` (default 50, max 100), `offset` (default 0)

**Exercise Ownership & Visibility:**

- Personal exercises are stored with `userId` on the `Exercise` model (not `coachId`).
- `GET /exercises` returns all **public** exercises plus the user's own private exercises.
- Only the owning user can update or delete their own exercises.
- Duplicate name checking is scoped to public exercises and the user's own exercises.

### Personal Routine Endpoints

| Method   | Endpoint                                                           | Description                         | Auth       |
| -------- | ------------------------------------------------------------------ | ----------------------------------- | ---------- |
| `POST`   | `/api/standalone/routines`                                         | Create a personal routine           | Yes (User) |
| `GET`    | `/api/standalone/routines`                                         | List user's routines (paginated)    | Yes (User) |
| `GET`    | `/api/standalone/routines/:routineId`                              | Get routine with exercises          | Yes (User) |
| `PATCH`  | `/api/standalone/routines/:routineId`                              | Update routine metadata             | Yes (User) |
| `DELETE` | `/api/standalone/routines/:routineId`                              | Delete routine (cascades exercises) | Yes (User) |
| `POST`   | `/api/standalone/routines/:routineId/exercises`                    | Add exercise to routine             | Yes (User) |
| `PATCH`  | `/api/standalone/routines/:routineId/exercises/:routineExerciseId` | Update exercise prescription        | Yes (User) |
| `DELETE` | `/api/standalone/routines/:routineId/exercises/:routineExerciseId` | Remove exercise from routine        | Yes (User) |

**GET Query Parameters** (list): `limit` (default 50, max 100), `offset` (default 0)

**Routine Exercise Access Rules:**

- Users can add **public** exercises or their own private exercises to a routine.
- Coach-private exercises (`isPublic=false`, `coachId` set, `userId` null) are **not** accessible.

### Personal Program Endpoints

| Method   | Endpoint                                                         | Description                      | Auth       |
| -------- | ---------------------------------------------------------------- | -------------------------------- | ---------- |
| `POST`   | `/api/standalone/programs`                                       | Create a personal program        | Yes (User) |
| `GET`    | `/api/standalone/programs`                                       | List user's programs (paginated) | Yes (User) |
| `GET`    | `/api/standalone/programs/active`                                | Get active program assignment    | Yes (User) |
| `GET`    | `/api/standalone/programs/:programId`                            | Get program with full tree       | Yes (User) |
| `PATCH`  | `/api/standalone/programs/:programId`                            | Update program name/description  | Yes (User) |
| `DELETE` | `/api/standalone/programs/:programId`                            | Delete program (cascades)        | Yes (User) |
| `POST`   | `/api/standalone/programs/:programId/routines`                   | Assign routine to program day    | Yes (User) |
| `PATCH`  | `/api/standalone/programs/:programId/routines/:programRoutineId` | Update day number                | Yes (User) |
| `DELETE` | `/api/standalone/programs/:programId/routines/:programRoutineId` | Remove routine from program      | Yes (User) |

**GET Query Parameters** (list): `limit` (default 50, max 100), `offset` (default 0)

### Self-Assignment Endpoints

| Method | Endpoint                                         | Description                 | Auth       |
| ------ | ------------------------------------------------ | --------------------------- | ---------- |
| `POST` | `/api/standalone/programs/:programId/activate`   | Activate a personal program | Yes (User) |
| `POST` | `/api/standalone/programs/:programId/deactivate` | Deactivate program          | Yes (User) |

**Activate Body** (optional):

```json
{
  "startDate": "2026-03-01T00:00:00.000Z"
}
```

- Defaults to current date if `startDate` is omitted.
- Deactivates any currently active user-owned program assignments before activating the new one.
- Uses upsert: re-activates an existing assignment if the user previously assigned this program.

### Today's Workout Endpoint

| Method | Endpoint                | Description                                 | Auth       |
| ------ | ----------------------- | ------------------------------------------- | ---------- |
| `GET`  | `/api/standalone/today` | Resolve today's routine from active program | Yes (User) |

**Query Parameters**: `assignedProgramId` (optional — filter to a specific assignment)

**Day-Cycling Logic:**

```
daysSinceStart = floor((today - startDate) / msPerDay)
totalCycleDays = max(dayNumber) across all ProgramRoutines
cycleDayNumber = (daysSinceStart % totalCycleDays) + 1
```

**Response Scenarios:**

| Scenario                | `today` | `isRestDay` | `message`                                    |
| ----------------------- | ------- | ----------- | -------------------------------------------- |
| No active program       | —       | —           | 404: "No active standalone program assigned" |
| Program has no routines | `null`  | `true`      | "Program has no routines scheduled"          |
| Program hasn't started  | `null`  | `false`     | "Program has not started yet"                |
| Rest day (no routine)   | `null`  | `true`      | —                                            |
| Workout day             | object  | `false`     | —                                            |

### Standalone Session Endpoints

| Method | Endpoint                                       | Description             | Auth       |
| ------ | ---------------------------------------------- | ----------------------- | ---------- |
| `POST` | `/api/standalone/sessions`                     | Start a workout session | Yes (User) |
| `GET`  | `/api/standalone/sessions/active`              | Get active session      | Yes (User) |
| `GET`  | `/api/standalone/sessions`                     | List past sessions      | Yes (User) |
| `GET`  | `/api/standalone/sessions/:sessionId`          | Get session detail      | Yes (User) |
| `POST` | `/api/standalone/sessions/:sessionId/complete` | Complete a session      | Yes (User) |

**Start Body** (optional):

```json
{
  "assignedProgramId": "clxxx..."
}
```

**GET Sessions Query Parameters**: `limit` (default 20, max 100), `offset` (default 0), `startDate`, `endDate` (ISO datetime)

**Session Rules:**

- Only one active (uncompleted) session at a time — returns 409 if a session is already in progress.
- If `assignedProgramId` is provided, it must belong to the user and reference a user-owned program.
- Set logging uses the existing `/api/workout/sets` and `/api/workout/sets/sync` endpoints (see [WORKOUT.md](WORKOUT.md)).

### Weekly Stats Endpoint

| Method | Endpoint                       | Description              | Auth       |
| ------ | ------------------------------ | ------------------------ | ---------- |
| `GET`  | `/api/standalone/stats/weekly` | Get weekly workout stats | Yes (User) |

**Query Parameters**: `weekOf` (optional ISO datetime — defaults to current week)

**Response:**

```json
{
  "data": {
    "stats": {
      "weekStart": "2026-02-23T00:00:00.000Z",
      "weekEnd": "2026-03-02T00:00:00.000Z",
      "workoutsCompleted": 4,
      "totalMinutes": 240,
      "streakDays": 3
    }
  },
  "errors": []
}
```

- `workoutsCompleted`: Completed sessions in the Monday–Sunday window.
- `totalMinutes`: Sum of session durations (`completedAt − startedAt`) in minutes.
- `streakDays`: Consecutive days (up to today) with at least one completed session, looking back up to 90 days.

---

## Database Models

All standalone resources share the same Prisma models as the coach flow. The key distinction is the ownership column:

| Model             | Coach Flow         | Standalone Flow        |
| ----------------- | ------------------ | ---------------------- |
| `Exercise`        | `coachId` set      | `userId` set           |
| `Routine`         | `coachId` set      | `userId` set           |
| `Program`         | `coachId` set      | `userId` set           |
| `AssignedProgram` | Coach assigns      | User self-assigns      |
| `WorkoutSession`  | Subscription-gated | No subscription needed |

### Key Models Used

- **Exercise**: `userId?`, `coachId?`, `isPublic`, `primaryMuscleGroup`, `targetMuscles`, `equipmentNeeded`
- **Routine**: `userId?`, `coachId?`, `name`, `description`, `estimatedDurationMinutes`, `muscleGroupsTargeted`
- **RoutineExercise**: Junction — `routineId`, `exerciseId`, `sets`, `repsMin`, `repsMax`, `restSeconds`, `orderInRoutine`, `notes`
- **Program**: `userId?`, `coachId?`, `name`, `description`
- **ProgramRoutine**: Junction — `programId`, `routineId`, `dayNumber`
- **AssignedProgram**: `userId`, `programId`, `startDate`, `endDate?`, `isActive`
- **WorkoutSession**: `userId`, `assignedProgramId?`, `startedAt`, `completedAt?`, `notes?`
- **PerformedSet**: `workoutSessionId`, `routineExerciseId`, `setNumber`, `repsCompleted`, `weightKg`, `rpe`, `notes`

---

## Request Flow

### Typical Standalone Workout Lifecycle

```
1. Create exercises      POST /api/standalone/exercises
2. Create routines       POST /api/standalone/routines
3. Add exercises         POST /api/standalone/routines/:id/exercises
4. Create program        POST /api/standalone/programs
5. Assign routines       POST /api/standalone/programs/:id/routines
6. Activate program      POST /api/standalone/programs/:id/activate
7. Check today           GET  /api/standalone/today
8. Start session         POST /api/standalone/sessions
9. Log sets              POST /api/workout/sets  (shared endpoint)
10. Complete session     POST /api/standalone/sessions/:id/complete
11. Check weekly stats   GET  /api/standalone/stats/weekly
```

### Middleware Pipeline

```
Request → authenticateSupabaseUser → requireAppUser → validateRequest(Schema) → Controller → Response
```

All standalone routes require authentication and a resolved `appUser`. No coach or subscription middleware is applied.

---

## Error Handling

| Status | Scenario                                                                       |
| ------ | ------------------------------------------------------------------------------ |
| 400    | No updatable fields provided                                                   |
| 401    | Missing or invalid authentication / user not resolved                          |
| 404    | Resource not found or not owned by the user                                    |
| 409    | Duplicate exercise name / duplicate routine assignment / active session exists |
| 500    | Internal server error                                                          |

All errors follow the standard `{ data: null, errors: [{ field?, message }] }` envelope.

---

## Related Documentation

- [CONTEXT.md](../CONTEXT.md) — Core patterns, response utilities, validation conventions
- [WORKOUT.md](WORKOUT.md) — Coach-assigned workout flow, set logging, and batch sync endpoints
- [PROGRAM.md](PROGRAM.md) — Coach program creation, routine management, and client assignment
- [FEATURE_INDEX.md](../FEATURE_INDEX.md) — Navigation hub for all feature documentation
