# Coach Client Progress Feature

> **Status**: ✅ Implemented  
> **Last Updated**: March 1, 2026  
> **Covers**: Coach visibility into client workout sessions, weekly stats, exercise history, enhanced performance report, and form analysis results

---

## Overview

### Purpose

The Coach Client Progress feature provides backend APIs for coaches to view detailed workout data, progress metrics, and form analysis results for their subscribed clients. This addresses the critical gap where coaches had no visibility into client exercise performance beyond a basic "good / falling behind" status.

### What's Included

- **Client Session List**: Paginated list of a client's workout sessions with set/exercise counts
- **Client Session Detail**: Full session breakdown with performed sets grouped by exercise
- **Client Weekly Stats**: Weekly aggregates (sessions, sets, reps, volume, duration) with previous-week delta
- **Client Exercise History**: Exercise-level progress over time, grouped by session with best-set tracking
- **Detailed Performance Report**: Enhanced report with volume, adherence rate, and session duration metrics
- **Client Form Results**: Form comparison result history for pose detection analysis

### Dependencies

| Package          | Version | Purpose             |
| ---------------- | ------- | ------------------- |
| `@prisma/client` | ^7.2.0  | Database operations |
| `zod`            | ^4.3.5  | Request validation  |
| `express`        | ^5.2.1  | HTTP routing        |

### Entry Points

| File                                   | Description                             |
| -------------------------------------- | --------------------------------------- |
| `/src/routes/coach.routes.ts`          | Route definitions for all new endpoints |
| `/src/controllers/coach.controller.ts` | Business logic handlers                 |
| `/src/schemas/coach.schema.ts`         | Zod validation schemas                  |

---

## Architecture

### Request Flow

```
Request with Authorization: Bearer <token>
    │
    ▼
authenticateSupabaseUser   →  Verifies Supabase JWT
    │
    ▼
requireCoach               →  Loads User + Coach; returns 403 if not a coach
    │
    ▼
validateRequest(Schema)    →  Validates params/query via Zod; stores in res.locals.validated
    │
    ▼
Controller                 →  Verifies coach-client relationship via SubscribedCoach,
                              queries workout data, returns response
```

### Authorization Model

Every endpoint verifies that the target `userId` is an active client of the requesting coach via the `SubscribedCoach` junction table (`endedAt: null`). If the relationship does not exist or has ended, a `404 Client not found in class` error is returned.

---

## API Endpoints

### 1. List Client Sessions

```
GET /api/coach/clients/:userId/sessions
```

**Auth**: `authenticateSupabaseUser` + `requireCoach`

**Path Parameters**:
| Param | Type | Description |
| -------- | ------ | -------------------- |
| `userId` | string | CUID of the client |

**Query Parameters**:
| Param | Type | Default | Description |
| ----------- | ------- | ------------- | ---------------------------------------- |
| `limit` | number | `20` | Page size (1–100) |
| `offset` | number | `0` | Pagination offset |
| `status` | enum | `"completed"` | `completed`, `active`, or `all` |
| `startDate` | string? | — | ISO datetime filter (session start >=) |
| `endDate` | string? | — | ISO datetime filter (session start <=) |

**Success Response** (`200`):

```json
{
  "data": {
    "sessions": [
      {
        "id": "clxyz...",
        "assignedProgramId": "clxyz...",
        "programName": "Beginner Strength",
        "startedAt": "2026-02-28T08:00:00.000Z",
        "completedAt": "2026-02-28T09:15:00.000Z",
        "durationMinutes": 75,
        "totalSets": 18,
        "uniqueExercises": 5,
        "notes": "Felt strong today"
      }
    ],
    "pagination": {
      "total": 42,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  },
  "errors": []
}
```

---

### 2. Client Session Detail

```
GET /api/coach/clients/:userId/sessions/:sessionId
```

**Auth**: `authenticateSupabaseUser` + `requireCoach`

**Path Parameters**:
| Param | Type | Description |
| ----------- | ------ | ---------------------- |
| `userId` | string | CUID of the client |
| `sessionId` | string | CUID of the session |

**Success Response** (`200`):

```json
{
  "data": {
    "session": {
      "id": "clxyz...",
      "userId": "clxyz...",
      "assignedProgramId": "clxyz...",
      "programName": "Beginner Strength",
      "startedAt": "2026-02-28T08:00:00.000Z",
      "completedAt": "2026-02-28T09:15:00.000Z",
      "durationMinutes": 75,
      "notes": null,
      "exercises": [
        {
          "exerciseId": "clxyz...",
          "exerciseName": "Barbell Squat",
          "primaryMuscleGroup": "QUADRICEPS",
          "sets": [
            {
              "id": "clxyz...",
              "setNumber": 1,
              "repsCompleted": 8,
              "weightKg": 80,
              "rpe": 7,
              "notes": null,
              "createdAt": "2026-02-28T08:15:00.000Z"
            }
          ]
        }
      ],
      "totalSets": 18,
      "totalReps": 142,
      "totalVolume": 8450.0,
      "createdAt": "2026-02-28T08:00:00.000Z",
      "updatedAt": "2026-02-28T09:15:00.000Z"
    }
  },
  "errors": []
}
```

**Key fields**:

- `exercises`: Sets grouped by exercise (not flat)
- `totalVolume`: Sum of `repsCompleted × weightKg` across all sets
- `durationMinutes`: `completedAt - startedAt` in minutes (null if active)

---

### 3. Client Weekly Stats

```
GET /api/coach/clients/:userId/stats/weekly
```

**Auth**: `authenticateSupabaseUser` + `requireCoach`

**Path Parameters**:
| Param | Type | Description |
| -------- | ------ | ------------------ |
| `userId` | string | CUID of the client |

**Query Parameters**:
| Param | Type | Default | Description |
| -------- | ------- | ------- | ---------------------------------------- |
| `weekOf` | string? | now | ISO datetime; determines the target week |

**Success Response** (`200`):

```json
{
  "data": {
    "stats": {
      "weekStart": "2026-02-23T00:00:00.000Z",
      "weekEnd": "2026-03-02T00:00:00.000Z",
      "sessionsCompleted": 4,
      "totalSets": 72,
      "totalReps": 580,
      "totalVolume": 24500.0,
      "totalMinutes": 280,
      "averageSessionDuration": 70,
      "delta": {
        "sessionsCompleted": 1,
        "totalSets": 12,
        "totalReps": 80,
        "totalVolume": 3200.0,
        "totalMinutes": 35
      }
    }
  },
  "errors": []
}
```

**Key fields**:

- `delta`: Difference compared to the previous week (positive = improvement)
- Week window is Monday–Sunday UTC
- `averageSessionDuration`: Average minutes per session

---

### 4. Client Exercise History

```
GET /api/coach/clients/:userId/exercises/:exerciseId/history
```

**Auth**: `authenticateSupabaseUser` + `requireCoach`

**Path Parameters**:
| Param | Type | Description |
| ------------ | ------ | -------------------- |
| `userId` | string | CUID of the client |
| `exerciseId` | string | CUID of the exercise |

**Query Parameters**:
| Param | Type | Default | Description |
| ------- | ------ | ------- | ---------------------------- |
| `limit` | number | `20` | Max sessions to return (1–100) |

**Success Response** (`200`):

```json
{
  "data": {
    "exercise": {
      "id": "clxyz...",
      "name": "Barbell Squat",
      "primaryMuscleGroup": "QUADRICEPS"
    },
    "history": [
      {
        "sessionId": "clxyz...",
        "date": "2026-02-28T08:00:00.000Z",
        "sets": [
          { "setNumber": 1, "repsCompleted": 8, "weightKg": 80, "rpe": 7 },
          { "setNumber": 2, "repsCompleted": 8, "weightKg": 82.5, "rpe": 8 },
          { "setNumber": 3, "repsCompleted": 6, "weightKg": 85, "rpe": 9 }
        ],
        "summary": {
          "totalSets": 3,
          "totalReps": 22,
          "maxWeight": 85,
          "totalVolume": 1320.0,
          "bestSet": {
            "setNumber": 2,
            "repsCompleted": 8,
            "weightKg": 82.5,
            "rpe": 8
          }
        }
      }
    ],
    "total": 15
  },
  "errors": []
}
```

**Key fields**:

- `history`: Array of sessions sorted most-recent-first
- `summary.bestSet`: Set with highest volume (`reps × weight`) in that session
- `summary.maxWeight`: Heaviest weight used in that session
- `total`: Total number of sessions where the exercise was performed

---

### 5. Detailed Performance Report

```
GET /api/coach/performance/detailed
```

**Auth**: `authenticateSupabaseUser` + `requireCoach`

**Query Parameters**:
| Param | Type | Default | Description |
| -------- | ------ | ------- | ------------------- |
| `limit` | number | `50` | Page size (1–100) |
| `offset` | number | `0` | Pagination offset |

**Success Response** (`200`):

```json
{
  "data": {
    "performance": [
      {
        "id": "clxyz...",
        "email": "client@example.com",
        "name": "Jane Doe",
        "nickname": "jane_d",
        "status": "good",
        "lastCompletedAt": "2026-02-28T09:15:00.000Z",
        "sessionsThisWeek": 4,
        "totalSets": 72,
        "totalReps": 580,
        "totalVolume": 24500.0,
        "averageSessionDuration": 70,
        "adherenceRate": 80,
        "activeProgramName": "Beginner Strength"
      }
    ],
    "summary": {
      "total": 12,
      "good": 9,
      "fallingBehind": 3,
      "averageAdherence": 72
    },
    "pagination": {
      "total": 12,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    }
  },
  "errors": []
}
```

**Key fields**:

- `sessionsThisWeek`: Completed sessions in last 7 days
- `totalVolume`: Sum of `reps × weight` in last 7 days
- `adherenceRate`: Percentage (0–100) of `sessionsCompleted / expectedSessions`
  - `expectedSessions` = number of routine day slots in the client's active program
  - `null` if no program routine days configured
- `averageSessionDuration`: Average minutes per session in last 7 days
- `summary.averageAdherence`: Average adherence across all clients with an active program

---

### 6. Client Form Results

```
GET /api/coach/clients/:userId/form-results
```

**Auth**: `authenticateSupabaseUser` + `requireCoach`

**Path Parameters**:
| Param | Type | Description |
| -------- | ------ | ------------------ |
| `userId` | string | CUID of the client |

**Query Parameters**:
| Param | Type | Default | Description |
| ------------ | ------- | ------- | --------------------------------- |
| `exerciseId` | string? | — | Filter to specific exercise |
| `limit` | number | `20` | Page size (1–100) |
| `offset` | number | `0` | Pagination offset |

**Success Response** (`200`):

```json
{
  "data": {
    "results": [
      {
        "id": "clxyz...",
        "overallScore": 0.87,
        "segmentScores": { "leftArm": 0.92, "rightArm": 0.85 },
        "corrections": [
          { "segment": "rightArm", "message": "Extend elbow fully" }
        ],
        "cameraAngle": "FRONT",
        "durationMs": 4500,
        "totalFrames": 135,
        "createdAt": "2026-02-28T08:20:00.000Z",
        "exerciseForm": {
          "id": "clxyz...",
          "cameraAngle": "FRONT",
          "exercise": { "id": "clxyz...", "name": "Barbell Squat" },
          "coach": { "id": "clxyz...", "name": "Coach Mike" }
        }
      }
    ],
    "pagination": {
      "total": 28,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  },
  "errors": []
}
```

---

## Error Responses

All endpoints return the standard `{ data, errors }` envelope.

| Condition                   | Status | Error Message              |
| --------------------------- | ------ | -------------------------- |
| No auth token               | `401`  | No token provided          |
| Invalid/expired token       | `401`  | Invalid or expired token   |
| User is not a coach         | `403`  | Coach profile required     |
| Client not in coach's class | `404`  | Client not found in class  |
| Session not found           | `404`  | Session not found          |
| Exercise not found          | `404`  | Exercise not found         |
| Validation error            | `400`  | Zod validation errors      |
| Server error                | `500`  | Failed to fetch [resource] |

---

## Data Model References

### Key Relationships

```
Coach ← SubscribedCoach → User (client)
                             ↓
                      WorkoutSession
                             ↓
                       PerformedSet → RoutineExercise → Exercise

User → FormComparisonResult → ExerciseForm → Exercise
```

### Coach-Client Verification

All endpoints use the helper function `verifyCoachClientRelationship()` which checks:

1. `SubscribedCoach` junction exists for `(userId, coachId)`
2. `endedAt` is `null` (client is still active)

---

## Flutter Mobile Integration Guide

### API Client Methods Needed

```dart
// Client Sessions
Future<PaginatedResponse<WorkoutSession>> getClientSessions(
  String userId, {int limit = 20, int offset = 0, String status = 'completed'});

// Client Session Detail
Future<SessionDetail> getClientSessionDetail(String userId, String sessionId);

// Client Weekly Stats
Future<WeeklyStats> getClientWeeklyStats(String userId, {DateTime? weekOf});

// Client Exercise History
Future<ExerciseHistory> getClientExerciseHistory(
  String userId, String exerciseId, {int limit = 20});

// Detailed Performance
Future<DetailedPerformance> getDetailedPerformance({int limit = 50, int offset = 0});

// Client Form Results
Future<PaginatedResponse<FormResult>> getClientFormResults(
  String userId, {String? exerciseId, int limit = 20, int offset = 0});
```

### Suggested UI Screens

1. **Client Detail Screen** — Show weekly stats card + recent sessions list
2. **Session Detail Screen** — Exercises with sets in expandable tiles
3. **Exercise Progress Screen** — Chart of weight/volume over time from exercise history
4. **Performance Dashboard** — Cards for each client with adherence %, volume trend, status badge
5. **Form Review Screen** — List of form results with score badges and correction details

### Key Considerations

- All endpoints use standard pagination (`limit`/`offset`/`hasMore`)
- Weekly stats `delta` values can be positive or negative — display with up/down arrows
- `adherenceRate` may be `null` if no program routine days are configured
- `totalVolume` is in kg (reps × weightKg) — display with appropriate unit
- Form results include `segmentScores` (JSON object) and `corrections` (JSON array) — parse dynamically
