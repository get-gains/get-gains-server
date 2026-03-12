# Workout Feature

> **Status**: ✅ Documented  
> **Last Updated**: March 9, 2026  
> **Covers**: Exercises (CRUD + Ownership), Routines, Workout Sessions, Performed Sets, Batch Sync, Weekly Stats

---

## Overview

### Purpose

The Workout feature provides the core fitness tracking functionality for the Get Gains application:

- **Exercises**: Browse, search, create, update, and delete exercises (with coach ownership / public visibility)
- **Routines**: View assigned workout routines from programs
- **Workout Sessions**: Start, track, and complete workout sessions
- **Set Logging**: Record individual sets with reps, weight, and RPE
- **Offline Sync**: Batch synchronization for offline-first mobile support
- **Weekly Stats**: Server-side aggregated workout statistics (workouts, minutes, streak)

### Scope

**This document covers:**

- Exercise CRUD with coach ownership and public/private visibility
- Routine listing from assigned programs
- Workout session lifecycle (start → log sets → complete)
- Individual set CRUD operations
- Batch set synchronization for offline support
- Weekly workout stats aggregation

**Not Included:**

- Routine creation (coach-only — see [PROGRAM.md](PROGRAM.md))
- Program assignment (coach dashboard — see [PROGRAM.md](PROGRAM.md))
- Personal records (PRs) tracking

### Dependencies

| Package          | Version | Purpose             |
| ---------------- | ------- | ------------------- |
| `@prisma/client` | ^7.2.0  | Database operations |
| `zod`            | ^4.3.5  | Request validation  |
| `express`        | ^5.2.1  | HTTP routing        |

### Entry Points

| File                                     | Description                                 |
| ---------------------------------------- | ------------------------------------------- |
| `/src/routes/workout.routes.ts`          | Route definitions for all workout endpoints |
| `/src/controllers/workout.controller.ts` | Business logic for workout operations       |
| `/src/schemas/workout.schema.ts`         | Zod validation schemas                      |
| `/prisma/schema.prisma`                  | Database models                             |

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
│  │                       WORKOUT ROUTES                             │   │
│  │  /api/workout/exercises, /routines, /sessions, /sets            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                              │                     │
│                    ▼                              ▼                     │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐  │
│  │   VALIDATION MIDDLEWARE │      │      AUTH MIDDLEWARE            │  │
│  │   (Zod Schemas)         │      │   (authenticateSupabaseUser)    │  │
│  └─────────────────────────┘      └─────────────────────────────────┘  │
│                    │                                                    │
│                    ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     WORKOUT CONTROLLER                           │   │
│  │  getExercises, getRoutines, startWorkoutSession,                 │   │
│  │  completeWorkoutSession, logSet, batchSyncSets                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                                                    │
│                    ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PRISMA CLIENT                               │   │
│  │  Exercise, Routine, WorkoutSession, PerformedSet models          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────┐
                         │   POSTGRESQL    │
                         │   (Database)    │
                         └─────────────────┘
```

---

## API Endpoints

### Exercise Endpoints

| Method   | Endpoint                             | Description                               | Auth        |
| -------- | ------------------------------------ | ----------------------------------------- | ----------- |
| `GET`    | `/api/workout/exercises`             | Get exercises with optional filtering     | Yes         |
| `POST`   | `/api/workout/exercises`             | Create a new exercise (coach only)        | Yes (Coach) |
| `PATCH`  | `/api/workout/exercises/:exerciseId` | Update an exercise (coach only, must own) | Yes (Coach) |
| `DELETE` | `/api/workout/exercises/:exerciseId` | Delete an exercise (coach only, must own) | Yes (Coach) |

**GET Query Parameters**: `muscleGroup`, `search`, `limit`, `offset`

**Exercise Ownership & Visibility:**

- Exercises have an optional `coachId` and an `isPublic` boolean (default `true`).
- `GET /exercises` returns all public exercises **plus** the requesting coach's private exercises (if authenticated as a coach).
- Only the owning coach can update or delete exercises they created. Global exercises (no `coachId`) cannot be modified via these endpoints.
- Duplicate name checking is scoped to public exercises and the coach's own exercises.

### Routine Endpoints

| Method | Endpoint                           | Description                  | Auth |
| ------ | ---------------------------------- | ---------------------------- | ---- |
| `GET`  | `/api/workout/routines`            | Get user's assigned routines | Yes  |
| `GET`  | `/api/workout/routines/:routineId` | Get single routine           | Yes  |

### Workout Session Endpoints

| Method | Endpoint                                    | Description                                  | Auth |
| ------ | ------------------------------------------- | -------------------------------------------- | ---- |
| `GET`  | `/api/workout/today`                        | Get today's scheduled routine + completedToday | Yes  |
| `POST` | `/api/workout/sessions`                     | Start a new workout session                  | Yes  |
| `GET`  | `/api/workout/sessions/active`              | Get active session                           | Yes  |
| `GET`  | `/api/workout/sessions`                     | Get session history                          | Yes  |
| `GET`  | `/api/workout/sessions/:sessionId`          | Get session by ID                            | Yes  |
| `POST` | `/api/workout/sessions/:sessionId/complete` | Complete a session                           | Yes  |

#### `GET /api/workout/today` Response

Returns the user's scheduled routine for today based on their active assigned program. Includes a `completedToday` boolean indicating whether a completed `WorkoutSession` exists with `completedAt >= todayStart` for the scheduled routine.

```json
{
  "data": {
    "today": {
      "routineId": "clxr123...",
      "routineName": "Push Day A",
      "dayNumber": 3,
      "programName": "Hypertrophy Block 1",
      "exercises": [...],
      "estimatedDurationMinutes": 45
    },
    "completedToday": true
  },
  "errors": []
}
```

### Performed Set Endpoints

| Method   | Endpoint                   | Description             | Auth |
| -------- | -------------------------- | ----------------------- | ---- |
| `POST`   | `/api/workout/sets`        | Log a new set           | Yes  |
| `PUT`    | `/api/workout/sets/:setId` | Update a set            | Yes  |
| `DELETE` | `/api/workout/sets/:setId` | Delete a set            | Yes  |
| `POST`   | `/api/workout/sets/sync`   | Batch sync offline sets | Yes  |

### Weekly Stats Endpoints

| Method | Endpoint                    | Description              | Auth |
| ------ | --------------------------- | ------------------------ | ---- |
| `GET`  | `/api/workout/stats/weekly` | Get weekly workout stats | Yes  |

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

- `workoutsCompleted`: Count of completed sessions in the Monday–Sunday window.
- `totalMinutes`: Sum of session durations (completedAt − startedAt) in minutes.
- `streakDays`: Consecutive days (up to today) with at least one completed session, looking back up to 90 days.

---

## Database Models

### Key Models

- **Exercise**: Exercise library (name, description, muscle groups, equipment, `coachId?`, `isPublic`)
- **Routine**: Workout template with exercises and prescribed sets/reps
- **RoutineExercise**: Junction linking exercises to routines with parameters
- **WorkoutSession**: A single workout performed by a user
- **PerformedSet**: Individual set logged during a session

### MuscleGroup Enum

```
TRAPS, SHOULDERS, CHEST, ABS, OBLIQUES,
UPPER_BACK, LATS, LOWER_BACK,
BICEPS, TRICEPS, FOREARMS,
GLUTES, QUADS, HAMSTRINGS, CALVES
```

---

## Offline Sync

The `/api/workout/sets/sync` endpoint supports batch synchronization for offline-first mobile usage:

```json
{
  "sets": [
    {
      "localId": "local-uuid-123",
      "workoutSessionId": "clxws123...",
      "routineExerciseId": "clxre123...",
      "setNumber": 1,
      "repsCompleted": 10,
      "weightKg": 80.0,
      "rpe": 7
    }
  ]
}
```

Returns success/failure status for each set with server-assigned IDs.

---

## Future Enhancements

- [ ] Personal records (PRs) tracking
- [ ] Progress tracking and detailed analytics
- [ ] Exercise video/image attachments
- [ ] Relax `requireSubscription()` on `POST /workout/sessions` to allow offline sync without active subscription
