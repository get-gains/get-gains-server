# Program Management (Coach Flow)

> **Last Updated**: February 21, 2026  
> **Status**: ✅ Fully Implemented (Coach flow)

## Overview

**Purpose:**  
The Program Management feature enables coaches to build structured training programs for their clients. Coaches create **reusable routines** composed of exercises from the global library, organize routines into **programs** by day number, and **assign programs** to clients. Clients can then view their scheduled workout for today, start sessions, and log sets.

**Scope:**  
This document covers the complete coach program flow end-to-end:
- Program CRUD
- Routine CRUD (standalone, reusable)
- ProgramRoutine junction management (assign/reorder/remove routines in programs)
- RoutineExercise junction management (add/update/remove exercises in routines)
- Program assignment to clients (assign/view/update/revoke)
- Client-facing "today's workout" resolution
- Subscription guards on coach-assigned content

> **Personal Programs** (user-created, no coach) are **not yet implemented** and will be handled in a separate task.

**Dependencies:**  
- Express.js v5
- Zod v4 (request validation)
- Prisma (Program, Routine, ProgramRoutine, RoutineExercise, AssignedProgram models)
- `requireCoach` middleware (coach-only routes)
- `requireSubscription` middleware (client access to coach-assigned content)

**Entry Points:**

| File | Purpose |
|------|---------|
| `src/routes/program.routes.ts` | Program CRUD + ProgramRoutine + RoutineExercise routes |
| `src/routes/routine.routes.ts` | Standalone routine CRUD routes |
| `src/routes/coach.routes.ts` | Assignment management routes + sub-router mounts |
| `src/routes/workout.routes.ts` | Client-facing routine/today/session routes |
| `src/controllers/program.controller.ts` | All program & routine business logic (16 handlers) |
| `src/controllers/coach.controller.ts` | Assignment management handlers |
| `src/controllers/workout.controller.ts` | Client-facing workout handlers (routines, today, sessions) |
| `src/schemas/program.schema.ts` | Zod schemas for program & routine operations |
| `src/schemas/coach.schema.ts` | Zod schemas for assignment operations |
| `src/schemas/workout.schema.ts` | Zod schemas for client workout operations |

---

## End-to-End Coach Program Flow

```
Coach creates Program (e.g. "Push Pull Legs")
  → Coach creates Routine (e.g. "Push Day")
    → Coach adds Exercise from global library (e.g. "Bench Press") with prescription
      → Coach assigns Routine to Program on a day number
        → Coach assigns Program to a Client
          → Client views today's scheduled workout
            → Client starts a workout session
              → Client logs sets (reps + weight + RPE)
```

All three nodes are **reusable**:
- A **Program** can be assigned to many clients
- A **Routine** can be reused across multiple programs
- An **Exercise** (global library) can be reused across routines

---

## Data Model

### Prisma Schema

```prisma
model Program {
  id          String @id @default(cuid())
  name        String
  description String @db.Text
  coachId     String
  coach       Coach  @relation(fields: [coachId], references: [id], onDelete: Cascade)
  programRoutines  ProgramRoutine[]
  assignedPrograms AssignedProgram[]
}

model Routine {
  id                       String        @id @default(cuid())
  coachId                  String
  coach                    Coach         @relation(...)
  name                     String
  description              String        @db.Text
  estimatedDurationMinutes Int
  muscleGroupsTargeted     MuscleGroup[]
  routineExercises         RoutineExercise[]
  programRoutines          ProgramRoutine[]
}

model ProgramRoutine {           // Junction: routine → program day slot
  id        String @id @default(cuid())
  programId String
  routineId String
  dayNumber Int                  // Day 1, Day 2, etc. in the program cycle
  @@unique([programId, routineId])
}

model RoutineExercise {          // Junction: exercise → routine with prescription
  id             String  @id @default(cuid())
  routineId      String
  exerciseId     String
  sets           Int
  repsMin        Int
  repsMax        Int
  restSeconds    Int
  orderInRoutine Int
  notes          String? @db.Text
  @@unique([routineId, exerciseId])
}

model AssignedProgram {
  id        String    @id @default(cuid())
  userId    String
  programId String
  startDate DateTime  @db.Timestamptz
  endDate   DateTime? @db.Timestamptz
  isActive  Boolean   @default(true)
  notes     String?   @db.Text
  workoutSessions WorkoutSession[]
  @@unique([userId, programId])
}
```

### Key Design Decisions

- **`Routine.coachId`**: Enforces ownership. Coaches can only manage their own routines.
- **`ProgramRoutine` junction**: Allows the same routine in multiple programs; each assignment has its own `dayNumber`.
- **`RoutineExercise` junction**: Stores the coach's prescription (sets/reps/rest) separately from the global `Exercise` record.
- **Cascade rules**: Deleting a Program cascades to `ProgramRoutine` but NOT to `Routine`. Deleting a Routine cascades to `RoutineExercise` but NOT to `Exercise`.

---

## API Endpoints

### Program CRUD

All routes are mounted at `/api/coach/programs` and require `authenticateSupabaseUser` + `requireCoach`.

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/` | `createProgram` | Create a new training program |
| `GET` | `/` | `getCoachPrograms` | List all coach's programs (paginated) |
| `GET` | `/:programId` | `getCoachProgramById` | Get program with full routine/exercise tree |
| `PATCH` | `/:programId` | `updateProgram` | Update name or description |
| `DELETE` | `/:programId` | `deleteProgram` | Delete program (cascades to ProgramRoutine) |

### Routine CRUD (Standalone)

All routes are mounted at `/api/coach/routines` and require `authenticateSupabaseUser` + `requireCoach`.

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/` | `createRoutine` | Create a reusable routine |
| `GET` | `/` | `getCoachRoutines` | List all coach's routines (paginated) |
| `GET` | `/:routineId` | `getCoachRoutineById` | Get routine with exercise list |
| `PATCH` | `/:routineId` | `updateRoutine` | Update routine fields |
| `DELETE` | `/:routineId` | `deleteRoutine` | Delete routine (cascades to RoutineExercise) |

### ProgramRoutine Junction (Routine ↔ Program Day Slot)

Mounted at `/api/coach/programs/:programId/routines`. Requires `authenticateSupabaseUser` + `requireCoach`.

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/` | `assignRoutineToProgram` | Assign a routine to a program day |
| `PATCH` | `/:programRoutineId` | `updateProgramRoutine` | Change the day number |
| `DELETE` | `/:programRoutineId` | `removeProgramRoutine` | Remove routine from program day |

### RoutineExercise Junction (Exercise ↔ Routine Prescription)

Mounted at `/api/coach/programs/routines/:routineId/exercises`. Requires `authenticateSupabaseUser` + `requireCoach`.

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/` | `addExerciseToRoutine` | Add exercise with prescription |
| `PATCH` | `/:routineExerciseId` | `updateRoutineExercise` | Update prescription (sets/reps/rest/order/notes) |
| `DELETE` | `/:routineExerciseId` | `removeRoutineExercise` | Remove exercise from routine |

### Program Assignment (Coach → Client)

Mounted at `/api/coach`. Requires `authenticateSupabaseUser` + `requireCoach`.

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/assign-program` | `assignProgram` | Assign program to client |
| `GET` | `/clients/:userId/programs` | `getClientPrograms` | List assignments for a client |
| `PATCH` | `/assign-program/:assignmentId` | `updateAssignment` | Update dates/notes/isActive |
| `DELETE` | `/assign-program/:assignmentId` | `deleteAssignment` | Delete assignment |

### Client-Facing Workout Endpoints

Mounted at `/api/workout`. Requires `authenticateSupabaseUser` + `requireSubscription()`.

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/routines` | `getRoutines` | Get coach-assigned routines |
| `GET` | `/routines/:routineId` | `getRoutineById` | Get single routine |
| `GET` | `/today` | `getTodayWorkout` | Get today's scheduled routine |
| `POST` | `/sessions` | `startWorkoutSession` | Start a workout session |

---

## Request/Response Examples

### Create Program

```
POST /api/coach/programs
Authorization: Bearer <token>

Body:
{
  "name": "Push Pull Legs",
  "description": "Classic 6-day hypertrophy split"
}

Response (201):
{
  "data": {
    "program": {
      "id": "clx...",
      "name": "Push Pull Legs",
      "description": "Classic 6-day hypertrophy split",
      "coachId": "clx...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  },
  "errors": []
}
```

### List Coach's Programs

```
GET /api/coach/programs?limit=50&offset=0
Authorization: Bearer <token>

Response (200):
{
  "data": {
    "programs": [
      {
        "id": "clx...",
        "name": "Push Pull Legs",
        "description": "Classic 6-day hypertrophy split",
        "routineCount": 6,
        "assignedClientCount": 3,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  },
  "errors": []
}
```

### Get Program with Full Tree

```
GET /api/coach/programs/:programId
Authorization: Bearer <token>

Response (200):
{
  "data": {
    "program": {
      "id": "clx...",
      "name": "Push Pull Legs",
      "description": "...",
      "coachId": "clx...",
      "createdAt": "...",
      "updatedAt": "...",
      "routines": [
        {
          "id": "clx...(programRoutineId)",
          "dayNumber": 1,
          "routine": {
            "id": "clx...",
            "coachId": "clx...",
            "name": "Push Day",
            "description": "...",
            "estimatedDurationMinutes": 60,
            "muscleGroupsTargeted": ["CHEST", "SHOULDERS", "TRICEPS"],
            "exercises": [
              {
                "id": "clx...(routineExerciseId)",
                "exerciseId": "clx...",
                "sets": 4,
                "repsMin": 8,
                "repsMax": 12,
                "restSeconds": 90,
                "orderInRoutine": 1,
                "notes": "Slow eccentric, 3 seconds down",
                "exercise": {
                  "id": "clx...",
                  "name": "Barbell Bench Press",
                  "description": "...",
                  "primaryMuscleGroup": "CHEST",
                  "equipmentNeeded": ["barbell", "bench"]
                }
              }
            ]
          }
        }
      ]
    }
  },
  "errors": []
}
```

### Create Routine

```
POST /api/coach/routines
Authorization: Bearer <token>

Body:
{
  "name": "Push Day",
  "description": "Chest, shoulders, triceps focus",
  "estimatedDurationMinutes": 60,
  "muscleGroupsTargeted": ["CHEST", "SHOULDERS", "TRICEPS"]
}

Response (201):
{
  "data": {
    "routine": {
      "id": "clx...",
      "coachId": "clx...",
      "name": "Push Day",
      "description": "Chest, shoulders, triceps focus",
      "estimatedDurationMinutes": 60,
      "muscleGroupsTargeted": ["CHEST", "SHOULDERS", "TRICEPS"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  },
  "errors": []
}
```

### Add Exercise to Routine

```
POST /api/coach/programs/routines/:routineId/exercises
Authorization: Bearer <token>

Body:
{
  "exerciseId": "clx...",
  "sets": 4,
  "repsMin": 8,
  "repsMax": 12,
  "restSeconds": 90,
  "orderInRoutine": 1,
  "notes": "Slow eccentric, 3 seconds down"
}

Response (201):
{
  "data": {
    "routineExercise": {
      "id": "clx...",
      "routineId": "clx...",
      "exerciseId": "clx...",
      "sets": 4,
      "repsMin": 8,
      "repsMax": 12,
      "restSeconds": 90,
      "orderInRoutine": 1,
      "notes": "Slow eccentric, 3 seconds down"
    }
  },
  "errors": []
}
```

### Assign Program to Client

```
POST /api/coach/assign-program
Authorization: Bearer <token>

Body:
{
  "userId": "clx...",
  "programId": "clx...",
  "startDate": "2026-02-24T00:00:00.000Z",
  "endDate": "2026-05-24T00:00:00.000Z",
  "notes": "Start light, progressive overload weekly"
}

Response (201):
{
  "data": {
    "assignment": {
      "id": "clx...",
      "userId": "clx...",
      "programId": "clx...",
      "startDate": "2026-02-24T00:00:00.000Z",
      "endDate": "2026-05-24T00:00:00.000Z",
      "notes": "Start light, progressive overload weekly",
      "program": { "id": "clx...", "name": "Push Pull Legs", "description": "..." },
      "user": { "id": "clx...", "email": "client@example.com", "name": "Jane", "nickname": "jane_gains" }
    }
  },
  "errors": []
}
```

### Get Today's Workout (Client)

```
GET /api/workout/today?assignedProgramId=clx...
Authorization: Bearer <token>

Response (200) — workout day:
{
  "data": {
    "today": {
      "programRoutineId": "clx...",
      "dayNumber": 1,
      "assignedProgramId": "clx...",
      "programName": "Push Pull Legs",
      "routine": {
        "id": "clx...",
        "name": "Push Day",
        "description": "...",
        "estimatedDurationMinutes": 60,
        "muscleGroupsTargeted": ["CHEST", "SHOULDERS", "TRICEPS"],
        "exercises": [...]
      }
    },
    "isRestDay": false
  },
  "errors": []
}

Response (200) — rest day:
{
  "data": {
    "today": null,
    "isRestDay": true,
    "dayNumber": 4,
    "assignedProgramId": "clx...",
    "programName": "Push Pull Legs"
  },
  "errors": []
}
```

---

## Validation Schemas

All schemas are defined in `src/schemas/program.schema.ts` and `src/schemas/coach.schema.ts`.

### Program Schemas

| Schema | Validates | Fields |
|--------|-----------|--------|
| `CreateProgramSchema` | `body` | `name` (string, min 1), `description` (string, min 1) |
| `GetCoachProgramsSchema` | `query` | `limit` (1-100, default 50), `offset` (≥0, default 0) |
| `GetCoachProgramByIdSchema` | `params` | `programId` (cuid) |
| `UpdateProgramSchema` | `params` + `body` | `programId` (cuid); `name?`, `description?` |
| `DeleteProgramSchema` | `params` | `programId` (cuid) |

### Routine Schemas

| Schema | Validates | Fields |
|--------|-----------|--------|
| `CreateRoutineSchema` | `body` | `name`, `description`, `estimatedDurationMinutes` (int ≥1), `muscleGroupsTargeted?` (string[]) |
| `GetCoachRoutinesSchema` | `query` | `limit`, `offset` |
| `GetCoachRoutineByIdSchema` | `params` | `routineId` (cuid) |
| `UpdateRoutineSchema` | `params` + `body` | `routineId`; `name?`, `description?`, `estimatedDurationMinutes?`, `muscleGroupsTargeted?` |
| `DeleteRoutineSchema` | `params` | `routineId` (cuid) |

### ProgramRoutine Schemas

| Schema | Validates | Fields |
|--------|-----------|--------|
| `AssignRoutineSchema` | `params` + `body` | `programId`; `routineId` (cuid), `dayNumber` (int, positive) |
| `UpdateProgramRoutineSchema` | `params` + `body` | `programId`, `programRoutineId`; `dayNumber` |
| `RemoveProgramRoutineSchema` | `params` | `programId`, `programRoutineId` |

### RoutineExercise Schemas

| Schema | Validates | Fields |
|--------|-----------|--------|
| `addRoutineExerciseSchema` | `params` + `body` | `routineId`; `exerciseId`, `sets`, `repsMin`, `repsMax`, `restSeconds`, `orderInRoutine`, `notes?` |
| `UpdateRoutineExerciseSchema` | `params` + `body` | `routineId`, `routineExerciseId`; all prescription fields optional, `notes` nullable |
| `RemoveRoutineExerciseSchema` | `params` | `routineId`, `routineExerciseId` |

### Assignment Schemas (in `coach.schema.ts`)

| Schema | Validates | Fields |
|--------|-----------|--------|
| `AssignProgramSchema` | `body` | `userId`, `programId`, `startDate` (datetime), `endDate?`, `notes?` |
| `GetClientProgramsSchema` | `params` | `userId` (cuid) |
| `UpdateAssignmentSchema` | `params` + `body` | `assignmentId`; `startDate?`, `endDate?` (nullable), `notes?` (nullable), `isActive?` |
| `DeleteAssignmentSchema` | `params` | `assignmentId` (cuid) |

---

## Security & Authorization

### Ownership Enforcement

Every coach endpoint verifies the authenticated coach owns the resource before allowing operations:

```typescript
// Pattern used across all program/routine controllers
const existing = await prisma.program.findUnique({ where: { id: programId } });
if (!existing || existing.coachId !== coach.id) {
    sendSingleError(res, 'Program not found or access denied', 404);
    return;
}
```

This applies to:
- Programs (`program.coachId === coach.id`)
- Routines (`routine.coachId === coach.id`)
- ProgramRoutine operations (verified via parent program ownership)
- RoutineExercise operations (verified via parent routine ownership)
- Assignments (verified via `assignment.program.coachId === coach.id`)

### Assignment Guards

Before assigning a program, the system verifies:
1. The program belongs to the coach
2. The client is in the coach's class (`SubscribedCoach` record exists and is active)
3. No duplicate active assignment exists (returns 409)

### Subscription Guards

Client-facing routes that access coach-assigned content require an active subscription:

| Route | Middleware |
|-------|-----------|
| `GET /api/workout/routines` | `requireSubscription()` |
| `GET /api/workout/routines/:routineId` | `requireSubscription()` |
| `GET /api/workout/today` | `requireSubscription()` |
| `POST /api/workout/sessions` | `requireSubscription()` |

The `requireSubscription()` middleware checks the user has an active subscription with sufficient tier level before granting access.

---

## Today's Workout Resolution Logic

The `GET /api/workout/today` endpoint resolves which routine a client should do today:

1. Find the user's active `AssignedProgram` (optionally filtered by `assignedProgramId` query param)
2. Load the full program tree (routines → exercises)
3. Calculate `daysSinceStart = floor((today - startDate) / msPerDay)`
4. If `daysSinceStart < 0` → program hasn't started yet
5. Determine `totalCycleDays = max(dayNumber)` across all `ProgramRoutine` records
6. Calculate `cycleDayNumber = (daysSinceStart % totalCycleDays) + 1`
7. Find the `ProgramRoutine` with matching `dayNumber`
8. If found → return the routine with exercises; if not → it's a rest day

This cycling logic means a 3-day program (days 1, 2, 3) repeats indefinitely: day 1 → day 2 → day 3 → day 1 → ...

---

## Error Handling

All controllers follow the standard pattern:

```typescript
try {
    // Business logic
    sendSuccess(res, { data }, statusCode);
} catch (error) {
    // Prisma unique constraint violations return 409
    if ((error as { code?: string }).code === 'P2002') {
        sendSingleError(res, 'Duplicate resource', 409);
        return;
    }
    logger.error('Context message', error);
    sendSingleError(res, 'User-friendly message', 500);
}
```

### Common Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No fields provided in PATCH request |
| 401 | Missing or invalid authentication |
| 403 | Coach required / Access denied / Client not in class / No active subscription |
| 404 | Resource not found or not owned by coach |
| 409 | Duplicate (routine already in program, exercise already in routine, program already assigned) |
| 500 | Internal server error |

---

## Route Registration

Routes are mounted via sub-routers in `coach.routes.ts`:

```typescript
// src/routes/coach.routes.ts
router.use('/programs', programRoutes);   // → /api/coach/programs/*
router.use('/routines', routineRoutes);   // → /api/coach/routines/*
router.use('/settings', coachSettingsRoutes);
router.use('/class', classRoutes);
```

And the coach router itself is registered in `src/index.ts`:

```typescript
app.use('/api/coach', coachRoutes);
app.use('/api/workout', workoutRoutes);
```

---

## Implementation Changelog (from MISSING_LINKS audit)

| # | Gap | Resolution |
|---|-----|------------|
| 1 | No "Create Routine" endpoint | ✅ `POST /api/coach/routines` |
| 2 | `Routine` has no `coachId` | ✅ Migration `20260221093755_add_coach_id_to_routine` |
| 3 | No read endpoints for coach programs | ✅ `GET /api/coach/programs` + `GET /api/coach/programs/:id` |
| 4 | No update/delete for programs | ✅ `PATCH` + `DELETE /api/coach/programs/:id` |
| 5 | No read/update/delete for routines | ✅ Full CRUD at `/api/coach/routines` |
| 6 | No remove/update ProgramRoutine | ✅ `PATCH` + `DELETE /api/coach/programs/:id/routines/:id` |
| 7 | No update/remove RoutineExercise | ✅ `PATCH` + `DELETE /api/coach/programs/routines/:id/exercises/:id` |
| 8 | No assignment management | ✅ View/update/delete at `/api/coach/assign-program` and `/clients/:userId/programs` |
| 9 | `addExerciseToRoutine` no ownership check | ✅ `routine.coachId !== coach.id` guard added |
| 10 | Dead `routineId` in `StartWorkoutSessionSchema` | ✅ Removed from schema; session takes only `assignedProgramId` |
| 11 | No "today's workout" endpoint | ✅ `GET /api/workout/today` with day cycling logic |
| 12 | Subscription guard on client routes | ✅ `requireSubscription()` on routines/today/sessions |

---