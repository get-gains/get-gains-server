# Client ↔ Coach End-to-End Flow Audit

> **Purpose**: Documents the complete server-side flow from client subscribing to a coach through to the coach viewing client progress. Identifies missing links and provides an implementation plan for program flexibility.

---

## Table of Contents

1. [Flow Overview](#flow-overview)
2. [Step 1 — Client Subscribes to Coach](#step-1--client-subscribes-to-coach)
3. [Step 2 — Coach Builds & Assigns Program](#step-2--coach-builds--assigns-program)
4. [Step 3 — Client Receives Program + Form Data](#step-3--client-receives-program--form-data)
5. [Step 4 — Client Logs Exercise Sets](#step-4--client-logs-exercise-sets)
6. [Step 5 — Coach Views Client Progress](#step-5--coach-views-client-progress)
7. [Gap Analysis — What's Missing](#gap-analysis--whats-missing)
8. [Data Integrity Risks](#data-integrity-risks)
9. [Implementation Plan — Coach Progress Visibility](#implementation-plan--coach-progress-visibility)
10. [Implementation Plan — Flexible Program Editing](#implementation-plan--flexible-program-editing)

---

## Flow Overview

```
Client                          Server                          Coach
  │                                                               │
  ├─ POST /user/coaches/:id ───► subscribeToCoach ◄──────────────┤ (coach has acceptingClients=true)
  │                                                               │
  │                                ┌─ createExercise              │
  │                                ├─ createRoutine          ◄────┤ Build library
  │                                ├─ addExerciseToRoutine        │
  │                                ├─ createProgram               │
  │                                ├─ assignRoutineToProgram ◄────┤ Build program
  │                                └─ assignProgram          ◄────┤ Assign to client
  │                                                               │
  ├─ GET  /workout/today ──────►  getTodayWorkout                 │
  ├─ GET  /pose/download/...  ►  bulkDownloadProgramForms         │
  ├─ POST /workout/sessions ───►  startWorkoutSession             │
  ├─ POST /workout/sets ───────►  logSet (reps, weight, RPE)      │
  ├─ POST /sessions/:id/complete► completeWorkoutSession          │
  │                                                               │
  │                                getPerformance ────────────────┤ good / falling_behind
  │                                ??? ───────────────────────────┤ Session detail? ❌ MISSING
  │                                ??? ───────────────────────────┤ Set-level data? ❌ MISSING
  │                                ??? ───────────────────────────┤ Exercise progress? ❌ MISSING
```

---

## Step 1 — Client Subscribes to Coach

**Status: ✅ Complete**

| Action                  | Method   | Endpoint                       | Controller             | Auth                        |
| ----------------------- | -------- | ------------------------------ | ---------------------- | --------------------------- |
| Discover coaches        | `GET`    | `/api/user/coaches`            | `discoverCoaches`      | No                          |
| View coach profile      | `GET`    | `/api/user/coaches/:coachId`   | `getCoachProfile`      | No                          |
| Subscribe to coach      | `POST`   | `/api/user/coaches/:coachId`   | `subscribeToCoach`     | Yes + `requireSubscription` |
| List subscribed coaches | `GET`    | `/api/user/coaches/subscribed` | `getSubscribedCoaches` | Yes                         |
| Unsubscribe             | `DELETE` | `/api/user/coaches/:coachId`   | `unsubscribeFromCoach` | Yes                         |

**Data model**: `SubscribedCoach` junction (`userId`, `coachId`) with `startedAt`/`endedAt` soft-delete. Coach capacity enforced via `coach.max_clients`, `coach.accepting_clients`, and `coach.is_discoverable` (exposed via `GET/PATCH /api/coach/settings`).

**Prerequisite**: Client must have an active platform subscription (`requireSubscription` middleware).

---

## Step 2 — Coach Builds & Assigns Program

**Status: ✅ Complete**

### 2a. Build Exercise Library

| Action          | Method   | Endpoint                     | Controller       |
| --------------- | -------- | ---------------------------- | ---------------- |
| Create exercise | `POST`   | `/api/workout/exercises`     | `createExercise` |
| List exercises  | `GET`    | `/api/workout/exercises`     | `getExercises`   |
| Update exercise | `PATCH`  | `/api/workout/exercises/:id` | `updateExercise` |
| Delete exercise | `DELETE` | `/api/workout/exercises/:id` | `deleteExercise` |

Exercises are owned by a coach (`coachId`) with `isPublic` visibility toggle.

### 2b. Build Routines

| Action                       | Method   | Endpoint                                                               | Controller              |
| ---------------------------- | -------- | ---------------------------------------------------------------------- | ----------------------- |
| Create routine               | `POST`   | `/api/coach/routines`                                                  | `createRoutine`         |
| List routines                | `GET`    | `/api/coach/routines`                                                  | `getCoachRoutines`      |
| Update routine               | `PATCH`  | `/api/coach/routines/:routineId`                                       | `updateRoutine`         |
| Delete routine               | `DELETE` | `/api/coach/routines/:routineId`                                       | `deleteRoutine`         |
| Add exercise to routine      | `POST`   | `/api/coach/programs/routines/:routineId/exercises`                    | `addExerciseToRoutine`  |
| Update exercise prescription | `PATCH`  | `/api/coach/programs/routines/:routineId/exercises/:routineExerciseId` | `updateRoutineExercise` |
| Remove exercise from routine | `DELETE` | `/api/coach/programs/routines/:routineId/exercises/:routineExerciseId` | `removeRoutineExercise` |

Each `RoutineExercise` stores a prescription: `sets`, `repsMin`, `repsMax`, `restSeconds`, `order`, `notes`.

### 2c. Build Programs

| Action                      | Method   | Endpoint                                                    | Controller               |
| --------------------------- | -------- | ----------------------------------------------------------- | ------------------------ |
| Create program              | `POST`   | `/api/coach/programs`                                       | `createProgram`          |
| List programs               | `GET`    | `/api/coach/programs`                                       | `getCoachPrograms`       |
| Get program detail          | `GET`    | `/api/coach/programs/:programId`                            | `getCoachProgramById`    |
| Update program              | `PATCH`  | `/api/coach/programs/:programId`                            | `updateProgram`          |
| Delete program              | `DELETE` | `/api/coach/programs/:programId`                            | `deleteProgram`          |
| Assign routine to day       | `POST`   | `/api/coach/programs/:programId/routines`                   | `assignRoutineToProgram` |
| Update routine day          | `PATCH`  | `/api/coach/programs/:programId/routines/:programRoutineId` | `updateProgramRoutine`   |
| Remove routine from program | `DELETE` | `/api/coach/programs/:programId/routines/:programRoutineId` | `removeProgramRoutine`   |

Programs can be created with `customForUserId` for one-off client-specific programs.

### 2d. Assign Program to Client

| Action                  | Method   | Endpoint                                  | Controller          |
| ----------------------- | -------- | ----------------------------------------- | ------------------- |
| Assign program          | `POST`   | `/api/coach/assign-program`               | `assignProgram`     |
| View client assignments | `GET`    | `/api/coach/clients/:userId/programs`     | `getClientPrograms` |
| Update assignment       | `PATCH`  | `/api/coach/assign-program/:assignmentId` | `updateAssignment`  |
| Delete assignment       | `DELETE` | `/api/coach/assign-program/:assignmentId` | `deleteAssignment`  |

**Data chain**: `AssignedProgram` → `Program` → `ProgramRoutine` (day slot) → `Routine` → `RoutineExercise` → `Exercise`

---

## Step 3 — Client Receives Program + Form Data

**Status: ✅ Complete**

| Action                        | Method | Endpoint                                  | Controller                 |
| ----------------------------- | ------ | ----------------------------------------- | -------------------------- |
| Today's workout (day cycling) | `GET`  | `/api/workout/today`                      | `getTodayWorkout`          |
| Assigned routines (full tree) | `GET`  | `/api/workout/routines`                   | `getRoutines`              |
| Bulk download pose forms      | `GET`  | `/api/pose/download/program/:programId`   | `bulkDownloadProgramForms` |
| Download exercise form        | `GET`  | `/api/pose/download/exercise/:exerciseId` | `downloadExerciseForm`     |

The client receives the complete `Program → Routine → Exercise` tree plus pose detection landmark data for form analysis.

---

## Step 4 — Client Logs Exercise Sets

**Status: ✅ Complete (coach-assigned path)**

| Action               | Method   | Endpoint                                    | Controller               |
| -------------------- | -------- | ------------------------------------------- | ------------------------ |
| Start session        | `POST`   | `/api/workout/sessions`                     | `startWorkoutSession`    |
| Get active session   | `GET`    | `/api/workout/sessions/active`              | `getActiveSession`       |
| Log a set            | `POST`   | `/api/workout/sets`                         | `logSet`                 |
| Update a set         | `PUT`    | `/api/workout/sets/:setId`                  | `updateSet`              |
| Delete a set         | `DELETE` | `/api/workout/sets/:setId`                  | `deleteSet`              |
| Batch sync (offline) | `POST`   | `/api/workout/sets/sync`                    | `batchSyncSets`          |
| Complete session     | `POST`   | `/api/workout/sessions/:sessionId/complete` | `completeWorkoutSession` |
| Session history      | `GET`    | `/api/workout/sessions`                     | `getWorkoutSessions`     |
| Session detail       | `GET`    | `/api/workout/sessions/:sessionId`          | `getWorkoutSessionById`  |
| Weekly stats         | `GET`    | `/api/workout/stats/weekly`                 | `getWeeklyStats`         |

**`PerformedSet` fields**: `setNumber`, `repsCompleted`, `weightKg` (nullable), `rpe` (nullable), `notes`

Each set is linked to a `WorkoutSession` and a `RoutineExercise`, preserving which exercise prescription it was logged against.

---

## Step 5 — Coach Views Client Progress

**Status: ❌ Incomplete — critical gaps**

### What Exists

| Action             | Method | Endpoint                              | Data Returned                                                |
| ------------------ | ------ | ------------------------------------- | ------------------------------------------------------------ |
| Client list        | `GET`  | `/api/coach/clients`                  | Clients with assigned programs, subscription info            |
| Client assignments | `GET`  | `/api/coach/clients/:userId/programs` | Assignment list (program name, dates, active flag)           |
| Performance report | `GET`  | `/api/coach/performance`              | `good` / `falling_behind` status based on last `completedAt` |
| Class roster       | `GET`  | `/api/coach/class`                    | Client roster (name, email, subscription)                    |

### What Does NOT Exist

| Missing Capability                                   | Impact                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| **Coach cannot view client workout sessions**        | No way to see which sessions a client completed, when, or duration     |
| **Coach cannot view client performed sets**          | No way to see actual reps/weight/RPE logged by a client                |
| **Coach cannot view client form comparison results** | No way to see pose detection form scores or corrections                |
| **No exercise-level progress tracking**              | Cannot track a client's progress on a specific exercise over time      |
| **No adherence/compliance metrics**                  | Cannot see % of expected workouts completed vs. scheduled              |
| **No volume aggregation per client**                 | No total sets/reps/weight summaries for a coach to review              |
| **Performance report is shallow**                    | Only `lastCompletedAt` timestamp — no volume, frequency, or trend data |

---

## Gap Analysis — What's Missing

### GAP 1: Coach Client Session Endpoints (Critical)

**Problem**: `WorkoutSession` and `PerformedSet` queries are user-scoped only (`userId: req.user.id`). No coach-facing endpoints exist to read client workout data.

**Required endpoints**:

| Method | Endpoint                                                   | Description                                    |
| ------ | ---------------------------------------------------------- | ---------------------------------------------- |
| `GET`  | `/api/coach/clients/:userId/sessions`                      | List a client's workout sessions (paginated)   |
| `GET`  | `/api/coach/clients/:userId/sessions/:sessionId`           | Session detail with all performed sets         |
| `GET`  | `/api/coach/clients/:userId/stats/weekly`                  | Client's weekly stats (sets, reps, volume)     |
| `GET`  | `/api/coach/clients/:userId/exercises/:exerciseId/history` | Exercise-level progress over time for a client |

All must verify the coach-client relationship via `SubscribedCoach`.

### GAP 2: Coach Performance Report Enhancement (High)

**Problem**: `GET /coach/performance` only returns `good`/`falling_behind` based on `completedAt`. A coach needs:

- Total sessions completed in period
- Total volume (sets × reps × weight)
- Adherence rate (sessions completed vs. program days in period)
- Last session date + duration

### GAP 3: Coach Client Form Scores (Medium)

**Problem**: `FormComparisonResult` data is only accessible via `GET /pose/results` (user-scoped). Coaches should be able to see form analysis results for their clients.

**Required endpoint**:

| Method | Endpoint                                  | Description                      |
| ------ | ----------------------------------------- | -------------------------------- |
| `GET`  | `/api/coach/clients/:userId/form-results` | Client's form comparison history |

### GAP 4: Standalone Set Logging (Low — separate concern)

**Problem**: Standalone routes (`/api/standalone/*`) have session lifecycle but no set logging endpoints (`POST /sets`, `PUT /sets/:id`, `DELETE /sets/:id`). Standalone users currently cannot log sets without using the subscription-gated `/workout/sets` path.

---

## Data Integrity Risks

These risks exist in the current implementation and affect program flexibility:

| Risk                                                              | Severity  | Description                                                                                                                                                                       |
| ----------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RoutineExercise deletion cascades to PerformedSet**             | 🔴 High   | When a coach removes an exercise from a routine, ALL historical `PerformedSet` rows referencing that `routineExerciseId` are deleted. Client workout history is permanently lost. |
| **Routine deletion cascades to ProgramRoutine + RoutineExercise** | 🔴 High   | Deleting a routine silently removes it from all programs and destroys all linked set data.                                                                                        |
| **Program deletion cascades to AssignedProgram**                  | 🔴 High   | Deleting a program silently unassigns all clients. Their `WorkoutSession.assignedProgramId` becomes `null` (SetNull), orphaning sessions.                                         |
| **No versioning / snapshots**                                     | 🟡 Medium | All program edits are live. Clients always see the latest version. No way to compare "what was assigned" vs. "what it looks like now".                                            |
| **No edit guards on active assignments**                          | 🟡 Medium | No warning or confirmation when editing a program/routine that has active client assignments.                                                                                     |

---

## Implementation Plan — Coach Progress Visibility

### Phase 1: Client Session Visibility (Priority: Critical)

Add endpoints to `coach.controller.ts` and `coach.routes.ts`:

#### 1a. `GET /api/coach/clients/:userId/sessions`

```
Query params: limit, offset, status (completed|active|all)
Response:
{
  data: {
    sessions: [{
      id, startedAt, completedAt, durationMinutes,
      assignedProgram: { id, program: { name } },
      setCount, exerciseCount
    }],
    pagination: { total, limit, offset }
  }
}
```

**Logic**:

1. Verify coach owns client (via `SubscribedCoach` where `endedAt: null`)
2. Query `WorkoutSession` where `userId = :userId`
3. Include aggregate counts for sets and distinct exercises
4. Apply pagination

#### 1b. `GET /api/coach/clients/:userId/sessions/:sessionId`

```
Response:
{
  data: {
    session: {
      id, startedAt, completedAt, notes,
      assignedProgram: { id, program: { name } },
      performedSets: [{
        id, setNumber, repsCompleted, weightKg, rpe, notes,
        routineExercise: {
          id, sets, repsMin, repsMax,
          exercise: { id, name, muscleGroup, equipment }
        }
      }]
    }
  }
}
```

### Phase 2: Client Stats & Progress (Priority: High)

#### 2a. `GET /api/coach/clients/:userId/stats/weekly`

Mirror the existing `getWeeklyStats` logic but for a specific client. Return:

- Sessions completed this week
- Total sets / total reps / total volume (weight × reps)
- Compared to previous week (delta)

#### 2b. `GET /api/coach/clients/:userId/exercises/:exerciseId/history`

```
Query params: limit (default 20)
Response:
{
  data: {
    exercise: { id, name },
    history: [{
      date, sessionId,
      sets: [{ setNumber, repsCompleted, weightKg, rpe }],
      bestSet: { reps, weight },
      totalVolume
    }]
  }
}
```

**Logic**: Query `PerformedSet` joined through `RoutineExercise → Exercise` where `exerciseId = :exerciseId` and `WorkoutSession.userId = :userId`, grouped by session.

### Phase 3: Enhanced Performance Report (Priority: Medium)

Extend `GET /api/coach/performance` to include:

- `sessionsThisWeek`: count of completed sessions in last 7 days
- `totalVolume`: sum of (repsCompleted × weightKg) in last 7 days
- `adherenceRate`: completedSessions / expectedSessions (based on program day count)
- `averageSessionDuration`: avg (completedAt - startedAt) in minutes

### Phase 4: Client Form Scores (Priority: Medium)

#### 4a. `GET /api/coach/clients/:userId/form-results`

```
Query params: exerciseId (optional), limit, offset
Response:
{
  data: {
    results: [{
      id, overallScore, feedback, createdAt,
      exercise: { id, name },
      limbScores: { ... }
    }]
  }
}
```

---

## Implementation Plan — Flexible Program Editing

The current implementation already supports live editing of programs, routines, and exercises. However, it lacks safety mechanisms. The plan below makes program editing **safe, auditable, and coach-friendly**.

### Current Capabilities (Already Implemented)

| Capability                                          | Endpoint                                                                  | Status                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| Add exercise to routine                             | `POST /coach/programs/routines/:routineId/exercises`                      | ✅ Works                                     |
| Update exercise prescription (sets/reps/rest/notes) | `PATCH /coach/programs/routines/:routineId/exercises/:routineExerciseId`  | ✅ Works                                     |
| Remove exercise from routine                        | `DELETE /coach/programs/routines/:routineId/exercises/:routineExerciseId` | ⚠️ Works but cascades delete to PerformedSet |
| Add routine to program                              | `POST /coach/programs/:programId/routines`                                | ✅ Works                                     |
| Change routine day                                  | `PATCH /coach/programs/:programId/routines/:programRoutineId`             | ✅ Works                                     |
| Remove routine from program                         | `DELETE /coach/programs/:programId/routines/:programRoutineId`            | ✅ Works                                     |
| Create custom program for client                    | `POST /coach/programs` (with `customForUserId`)                           | ✅ Works                                     |
| Coach exercise library                              | Full CRUD on `/workout/exercises`                                         | ✅ Works                                     |

### What Needs to Change

#### Change 1: Protect Historical Workout Data (Critical)

**Problem**: Deleting a `RoutineExercise` cascades to `PerformedSet`, destroying all historical set data.

**Solution — Soft Delete on RoutineExercise**:

1. Add `deletedAt DateTime?` to `RoutineExercise` model
2. When a coach "removes" an exercise, set `deletedAt = now()` instead of hard-deleting
3. Client-facing queries filter `WHERE deletedAt IS NULL` — client no longer sees the exercise
4. `PerformedSet` rows remain intact, preserving history
5. Coach can see historical data through the soft-deleted reference

**Schema change**:

```prisma
model RoutineExercise {
  // ... existing fields ...
  deletedAt DateTime?  // Soft delete — preserves PerformedSet history
}
```

**Controller change**: `removeRoutineExercise` → `update({ deletedAt: new Date() })` instead of `delete()`.

#### Change 2: Exercise Swap Endpoint (High)

**Problem**: To swap an exercise, the coach must manually delete + re-add. This is error-prone and the delete destroys history.

**Solution — Add `PUT /coach/programs/routines/:routineId/exercises/:routineExerciseId/swap`**:

```
Body: { exerciseId: "new-exercise-id" }
```

**Logic**:

1. Soft-delete the current `RoutineExercise` (`deletedAt = now()`)
2. Create a new `RoutineExercise` with the new `exerciseId`, inheriting `order`, `sets`, `repsMin`, `repsMax`, `restSeconds` from the old one
3. Return the new `RoutineExercise`

This preserves history for the old exercise while cleanly introducing the new one.

#### Change 3: Active Assignment Guard (Medium)

**Problem**: No warning when editing entities tied to active assignments.

**Solution — Add `affectedClients` count to mutation responses**:

When a coach modifies a routine or program that has active `AssignedProgram` records, include in the response:

```json
{
  "data": { "routineExercise": { ... } },
  "meta": {
    "affectedClients": 12,
    "warning": "This change affects 12 clients with active assignments"
  }
}
```

**Logic**: Before returning, count `AssignedProgram WHERE isActive = true AND program.programRoutines.some(routineId = :routineId)`.

The mobile app can show a confirmation dialog based on `meta.affectedClients > 0`.

#### Change 4: Program Snapshot at Assignment (Low — Future)

**Problem**: No way to compare "what was assigned originally" vs. "what it looks like now".

**Solution — Snapshot on assign**:

1. Add `snapshotJson Json?` column to `AssignedProgram`
2. When `assignProgram` is called, serialize the current `Program → ProgramRoutine → Routine → RoutineExercise → Exercise` tree as JSON and store it
3. Add `GET /api/coach/clients/:userId/programs/:assignmentId/snapshot` to retrieve original vs. current

This is a future enhancement — not blocking for MVP.

### Editing Flow Summary (After Changes)

```
Coach wants to update a client's routine:

1. GET /coach/programs/:programId
   → See full program with routines and exercises

2. POST /coach/programs/routines/:routineId/exercises
   → Add new exercise from coach's exercise library
   → Response includes affectedClients count

3. PATCH /coach/programs/routines/:routineId/exercises/:id
   → Update prescription (sets: 4, repsMin: 8, repsMax: 12)

4. DELETE /coach/programs/routines/:routineId/exercises/:id
   → Soft-deletes exercise (hidden from client, history preserved)

5. PUT /coach/programs/routines/:routineId/exercises/:id/swap
   → Replace exercise with different one (history preserved)

All changes are live — client sees them on next GET /workout/today
```

---

## Implementation Priority & Sequencing

| #   | Task                                                       | Priority    | Estimated Effort | Depends On |
| --- | ---------------------------------------------------------- | ----------- | ---------------- | ---------- |
| 1   | Soft-delete on `RoutineExercise` (schema + controller)     | 🔴 Critical | 2-3 hours        | —          |
| 2   | `GET /coach/clients/:userId/sessions`                      | 🔴 Critical | 2-3 hours        | —          |
| 3   | `GET /coach/clients/:userId/sessions/:sessionId`           | 🔴 Critical | 1-2 hours        | #2         |
| 4   | `GET /coach/clients/:userId/stats/weekly`                  | 🟠 High     | 2-3 hours        | —          |
| 5   | Exercise swap endpoint                                     | 🟠 High     | 2-3 hours        | #1         |
| 6   | `GET /coach/clients/:userId/exercises/:exerciseId/history` | 🟠 High     | 2-3 hours        | —          |
| 7   | Enhanced performance report                                | 🟡 Medium   | 3-4 hours        | #2         |
| 8   | Active assignment guard (affectedClients in response)      | 🟡 Medium   | 2-3 hours        | —          |
| 9   | `GET /coach/clients/:userId/form-results`                  | 🟡 Medium   | 2-3 hours        | —          |
| 10  | Program snapshot at assignment                             | 🟢 Low      | 4-5 hours        | —          |

**Total estimated effort**: ~25-30 hours

---

## Files to Modify

| File                                    | Changes                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                  | Add `deletedAt` to `RoutineExercise`; add `snapshotJson` to `AssignedProgram` (future) |
| `src/controllers/coach.controller.ts`   | Add client session/stats/form endpoints                                                |
| `src/controllers/program.controller.ts` | Soft-delete logic; swap endpoint; affectedClients guard                                |
| `src/routes/coach.routes.ts`            | Register new coach client-progress endpoints                                           |
| `src/routes/program.routes.ts`          | Register swap endpoint (if separate from coach routes)                                 |
| `src/schemas/coach.schema.ts`           | Validation schemas for new endpoints                                                   |
| `src/schemas/program.schema.ts`         | Swap schema                                                                            |
| `src/middleware/auth.middleware.ts`     | Possible helper for coach-client relationship verification                             |
