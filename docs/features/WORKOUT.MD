# Workout Feature

> **Status**: ✅ Documented  
> **Last Updated**: January 31, 2026  
> **Covers**: Exercises, Routines, Workout Sessions, Performed Sets, Batch Sync

---

## Overview

### Purpose

The Workout feature provides the core fitness tracking functionality for the Get Gains application:

- **Exercises**: Browse and search the exercise library
- **Routines**: View assigned workout routines from programs
- **Workout Sessions**: Start, track, and complete workout sessions
- **Set Logging**: Record individual sets with reps, weight, and RPE
- **Offline Sync**: Batch synchronization for offline-first mobile support

### Scope

**This document covers:**
- Exercise retrieval with filtering and search
- Routine listing from assigned programs
- Workout session lifecycle (start → log sets → complete)
- Individual set CRUD operations
- Batch set synchronization for offline support

**Not Included:**
- Exercise creation/editing (coach-only, not yet implemented)
- Routine creation (coach-only, not yet implemented)
- Program assignment (coach dashboard, not yet implemented)
- Progress analytics and statistics

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | ^7.2.0 | Database operations |
| `zod` | ^4.3.5 | Request validation |
| `express` | ^5.2.1 | HTTP routing |

### Entry Points

| File | Description |
|------|-------------|
| `/src/routes/workout.routes.ts` | Route definitions for all workout endpoints |
| `/src/controllers/workout.controller.ts` | Business logic for workout operations |
| `/src/schemas/workout.schema.ts` | Zod validation schemas |
| `/prisma/schema.prisma` | Database models |

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

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/workout/exercises` | Get exercises with optional filtering | Yes |

**Query Parameters**: `muscleGroup`, `search`, `limit`, `offset`

### Routine Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/workout/routines` | Get user's assigned routines | Yes |
| `GET` | `/api/workout/routines/:routineId` | Get single routine | Yes |

### Workout Session Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/workout/sessions` | Start a new workout session | Yes |
| `GET` | `/api/workout/sessions/active` | Get active session | Yes |
| `GET` | `/api/workout/sessions` | Get session history | Yes |
| `GET` | `/api/workout/sessions/:sessionId` | Get session by ID | Yes |
| `POST` | `/api/workout/sessions/:sessionId/complete` | Complete a session | Yes |

### Performed Set Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/workout/sets` | Log a new set | Yes |
| `PUT` | `/api/workout/sets/:setId` | Update a set | Yes |
| `DELETE` | `/api/workout/sets/:setId` | Delete a set | Yes |
| `POST` | `/api/workout/sets/sync` | Batch sync offline sets | Yes |

---

## Database Models

### Key Models

- **Exercise**: Exercise library (name, description, muscle groups, equipment)
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

- [ ] Exercise creation/editing (coach-only)
- [ ] Routine creation with exercise selection (coach-only)
- [ ] Program management and assignment
- [ ] Progress tracking and analytics
- [ ] Personal records (PRs) tracking