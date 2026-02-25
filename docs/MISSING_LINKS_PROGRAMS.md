# Missing Links: Programs Architecture Audit

> **Branch**: `subtask/GG-56-link-coach-programs-to-personal-programs`  
> **Date**: February 21, 2026  
> **Scope**: Coach program flow + Personal program flow end-to-end gap analysis

---

## Flows Under Review

### Coach Program Flow (end-to-end)
```
Coach creates Program (e.g. Push Pull Legs)
  → Coach creates Routine (e.g. Push)
    → Coach creates Exercise (e.g. Bench Press) [with optional pose recording]
      → Exercise is added to Routine with prescription (sets/reps/rest)
        → Routine is assigned to Program on a day number
          → Program is assigned to a specific Client
            → Client performs the workout
              → Client logs sets (reps + weight + RPE)
```
All three nodes (Program, Routine, Exercise) are **reusable**:  
a program can be assigned to many clients, a routine can be reused across programs, an exercise can be reused across routines.

### Personal Program Flow (end-to-end)
```
User creates own Program
  → User creates own Routine
    → User picks an Exercise from the global library
      → User logs sets (reps + weight)
```
No coach involved. No subscription required.

---

## Current State Summary

| Layer | Coach Programs | Personal Programs |
|-------|----------------|-------------------|
| Prisma Schema | ⚠️ Partial (Routine has no owner) | ❌ Missing entirely |
| Create Program | ✅ `POST /api/coach/programs` | ❌ |
| Read Programs | ❌ No list/get endpoints | ❌ |
| Update/Delete Program | ❌ | ❌ |
| Create Routine | ❌ **No endpoint exists** | ❌ |
| Read Routines | ❌ Coach view missing | ❌ |
| Update/Delete Routine | ❌ | ❌ |
| Assign Routine → Program | ✅ `POST /api/coach/programs/:id/routines` | N/A |
| Remove Routine from Program | ❌ | N/A |
| Create Exercise (global) | ✅ `POST /api/workout/exercises` (coach only) | ✅ shared library |
| Add Exercise → Routine | ✅ `POST /api/coach/programs/routines/:id/exercises` | ❌ |
| Update/Remove Exercise from Routine | ❌ | ❌ |
| Assign Program → Client | ✅ `POST /api/coach/assign-program` | N/A |
| Revoke/Update Assignment | ❌ | N/A |
| Client: View assigned routines | ✅ `GET /api/workout/routines` | ❌ |
| Client: Start workout session | ✅ `POST /api/workout/sessions` | ✅ (but no personal link) |
| Client: Log sets | ✅ `POST /api/workout/sets` | ✅ (but no personal link) |
| Subscription guard on client coach features | ⚠️ Partial | N/A (free) |

---

## Missing Links — Detailed Breakdown

---

### 1. ❌ CRITICAL: No "Create Routine" Endpoint

**The most foundational gap.** The flow states:  
*"Coach creates a routine (e.g. Push)"*

The `POST /api/coach/programs/:programId/routines` endpoint expects an **existing** `routineId` in the body — it is an _assign_ operation, not a _create_ operation. There is no endpoint to create a new `Routine` record.

**Needed:**
```
POST /api/coach/routines
  body: { name, description, estimatedDurationMinutes, muscleGroupsTargeted[] }
  → creates Routine, returns { routine }
```

**Also needed (see point 2):** The `Routine` model has no `coachId`, so ownership is currently unenforceable.

---

### 2. ❌ SCHEMA: `Routine` Has No Owner (`coachId`)

**Current Prisma model:**
```prisma
model Routine {
  id                       String          @id @default(cuid())
  name                     String
  description              String          @db.Text
  estimatedDurationMinutes Int
  muscleGroupsTargeted     MuscleGroup[]
  ...
}
```

`Routine` is ownerless. Consequences:
- A coach **cannot list "their own" routines** for reuse in another program
- The `addExerciseToRoutine` controller **does not verify** the coach owns the routine — any coach can add exercises to any routine (security hole)
- Deleting/updating a routine cannot be scoped to its owner

**Required schema change:**
```prisma
model Routine {
  id      String  @id @default(cuid())
  coachId String  // Add this
  coach   Coach   @relation(fields: [coachId], references: [id], onDelete: Cascade)
  ...
}
```

---

### 3. ❌ No Read Endpoints for Coach's Own Programs

A coach has no way to see what programs they've created.

**Needed:**
```
GET /api/coach/programs
  → list all programs belonging to the coach (with routines summary)

GET /api/coach/programs/:programId
  → single program with full routine/exercise tree
```

---

### 4. ❌ No Update/Delete for Programs

**Needed:**
```
PATCH /api/coach/programs/:programId
  body: { name?, description? }

DELETE /api/coach/programs/:programId
  → cascades to ProgramRoutine; does NOT delete Routines (reusable)
```

---

### 5. ❌ No Read/Update/Delete for Coach Routines

Once a routine exists (after point 1 is fixed), there's no way to manage it.

**Needed:**
```
GET  /api/coach/routines
  → list all routines owned by this coach (for reuse selection)

GET  /api/coach/routines/:routineId
  → single routine with exercise list

PATCH /api/coach/routines/:routineId
  body: { name?, description?, estimatedDurationMinutes?, muscleGroupsTargeted? }

DELETE /api/coach/routines/:routineId
  → cascades to RoutineExercise; does NOT delete Exercises (global library)
```

---

### 6. ❌ No Remove/Update of Routine-in-Program (ProgramRoutine junction)

Coaches can add routines to programs but cannot remove or reorder them.

**Needed:**
```
DELETE /api/coach/programs/:programId/routines/:programRoutineId
  → removes the day slot; does NOT delete the Routine

PATCH  /api/coach/programs/:programId/routines/:programRoutineId
  body: { dayNumber }
  → reassign the day number for a routine in this program
```

---

### 7. ❌ No Update/Remove of Exercise-in-Routine (RoutineExercise junction)

Coaches can add an exercise to a routine but cannot change its prescription or remove it.

**Needed:**
```
PATCH  /api/coach/programs/routines/:routineId/exercises/:routineExerciseId
  body: { sets?, repsMin?, repsMax?, restSeconds?, orderInRoutine?, notes? }

DELETE /api/coach/programs/routines/:routineId/exercises/:routineExerciseId
  → removes the slot; does NOT delete the Exercise (global library)
```

---

### 8. ❌ No Program Assignment Management (Coach side)

A coach can assign a program to a client but cannot see, update, or revoke assignments.

**Needed:**
```
GET    /api/coach/clients/:userId/programs
  → list all program assignments for a specific client

PATCH  /api/coach/assign-program/:assignmentId
  body: { startDate?, endDate?, notes?, isActive? }
  → update dates/notes or deactivate the assignment

DELETE /api/coach/assign-program/:assignmentId
  → hard-delete or soft-deactivate assignment
```

---

### 9. ⚠️ Security Hole: `addExerciseToRoutine` Has No Ownership Check

**Current code:**
```typescript
// src/controllers/program.controller.ts
export const addExerciseToRoutine = async (req, res) => {
  const coach = req.coach; // ✅ confirms caller is a coach
  const routine = await prisma.routine.findUnique({ where: { id: rid } });
  if (!routine) { ... } // ✅ checks routine exists
  // ❌ MISSING: no check that routine.coachId === coach.id
  await prisma.routineExercise.create({ data: { routineId: rid, ...data } });
};
```

Any authenticated coach can append exercises to **any other coach's routine**. Once `coachId` is added to `Routine` (point 2), this guard must be added:
```typescript
if (routine.coachId !== coach.id) {
  sendSingleError(res, 'Routine not found or access denied', 403);
  return;
}
```

Same ownership check must be applied to the future update/delete routine endpoints.

---

### 10. ⚠️ Dead Field: `routineId` in `StartWorkoutSessionSchema`

`StartWorkoutSessionSchema` accepts `routineId` but `WorkoutSession` has no such column, and the controller destructures it but never uses it:

```typescript
// schema accepts it
const { routineId, assignedProgramId } = req.body;
// but WorkoutSession.create() never receives routineId
```

**Decision needed:** Either remove `routineId` from the schema or add it to `WorkoutSession`. For personal programs, the session likely needs a `personalProgramId` or `personalRoutineId` link instead.

---

### 11. ❌ "What's My Workout Today?" Endpoint Missing

`AssignedProgram` has `startDate` and `ProgramRoutine` has `dayNumber`, but there is no API to resolve:

> "Given today's date and my assigned program, which routine should I do today?"

**Needed:**
```
GET /api/workout/today
  → resolves current day number from (today - assignment.startDate),
    returns the routine scheduled for that day
```

This is the bridge between scheduling and consistency tracking.

---

### 12. ⚠️ Subscription Guard: Client Access to Coach-Assigned Program Content

**Subscribed coach feature** — meaning clients must have an active platform subscription to use coach-assigned content. Currently only `POST /user/coaches/:coachId` (subscribe to coach) is gated:

| Route | Current Guard | Should Have |
|-------|--------------|-------------|
| `POST /user/coaches/:coachId` | `requireSubscription()` | ✅ correct |
| `GET /workout/routines` | `authenticateSupabaseUser` only | ⚠️ Should gate coach-assigned routines |
| `POST /workout/sessions` | `authenticateSupabaseUser` only | ⚠️ Should gate sessions from coach programs |

**Recommended approach:** In the `getRoutines` controller, if no active subscription is found and the routines come from a coach-assigned program, return 403. The cleanest route-level solution:
- Add `requireSubscription()` to `GET /workout/routines` — OR —
- Add an `assignedByCoach` query param path that gates specifically, leaving personal routines open once personal programs are implemented.

---

---

## Personal Programs — Full Gap (Nothing Exists)

### 13. ❌ No Prisma Schema for Personal Programs

Neither a separate set of models nor a polymorphic extension exists.

**Two architectural options:**

**Option A — Separate Models (recommended for clarity):**
```prisma
model PersonalProgram {
  id          String @id @default(cuid())
  userId      String
  name        String
  description String @db.Text
  isActive    Boolean @default(true)
  user        User    @relation(...)
  routines    PersonalRoutine[]
  sessions    WorkoutSession[]
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz
}

model PersonalRoutine {
  id                       String @id @default(cuid())
  personalProgramId        String
  userId                   String
  name                     String
  description              String @db.Text
  estimatedDurationMinutes Int
  muscleGroupsTargeted     MuscleGroup[]
  dayNumber                Int
  personalProgram          PersonalProgram  @relation(...)
  user                     User             @relation(...)
  exercises                PersonalRoutineExercise[]
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz
}

model PersonalRoutineExercise {
  id                String @id @default(cuid())
  personalRoutineId String
  exerciseId        String       // links to the global Exercise library
  sets              Int
  repsMin           Int
  repsMax           Int
  restSeconds       Int
  orderInRoutine    Int
  notes             String? @db.Text
  personalRoutine   PersonalRoutine @relation(...)
  exercise          Exercise        @relation(...)
  performedSets     PerformedSet[]
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz
}
```

**Option B — Polymorphic (extend existing models, leaner schema):**
- Add `userId String?` (optional) and make `coachId String?` (optional) on `Program` and `Routine`
- Add check constraint: exactly one of `coachId`/`userId` must be set
- `isPersonal Boolean @default(false)` flag to distinguish

Option A is preferred: clearer ownership, no nullable foreign keys on shared models, no risk of accidentally querying cross-ownership.

---

### 14. ❌ No Personal Program API Endpoints

All of these are needed under `/api/personal` (or `/api/workout/personal`):

```
POST   /api/personal/programs
  body: { name, description }
  → creates PersonalProgram for authenticated user

GET    /api/personal/programs
  → lists user's personal programs

GET    /api/personal/programs/:programId
  → single program with full routine/exercise tree

PATCH  /api/personal/programs/:programId
  body: { name?, description?, isActive? }

DELETE /api/personal/programs/:programId
  → cascades to PersonalRoutines

POST   /api/personal/programs/:programId/routines
  body: { name, description, estimatedDurationMinutes, muscleGroupsTargeted[], dayNumber }
  → creates PersonalRoutine inside the program

GET    /api/personal/programs/:programId/routines
  → routines for this program

GET    /api/personal/routines/:routineId
  → single routine with exercises

PATCH  /api/personal/routines/:routineId
  body: { name?, description?, estimatedDurationMinutes?, muscleGroupsTargeted?, dayNumber? }

DELETE /api/personal/routines/:routineId

POST   /api/personal/routines/:routineId/exercises
  body: { exerciseId, sets, repsMin, repsMax, restSeconds, orderInRoutine, notes? }
  → adds an exercise from the global library to this personal routine

PATCH  /api/personal/routines/:routineId/exercises/:routineExerciseId
  body: { sets?, repsMin?, repsMax?, restSeconds?, orderInRoutine?, notes? }

DELETE /api/personal/routines/:routineId/exercises/:routineExerciseId
```

---

### 15. ❌ WorkoutSession Does Not Link to Personal Programs

`WorkoutSession.assignedProgramId` links only to `AssignedProgram` (coach-assigned). Personal program sessions have no linkage in the current schema.

**Needed schema addition on `WorkoutSession`:**
```prisma
model WorkoutSession {
  ...
  assignedProgramId    String? // existing — coach-assigned program
  personalProgramId    String? // new — user's own program
  personalRoutineId    String? // new — which personal routine was done
  personalProgram      PersonalProgram?  @relation(...)
  personalRoutine      PersonalRoutine?  @relation(...)
}
```

**Similarly, `PerformedSet.routineExerciseId`** currently only links to `RoutineExercise` (coach-prescribed). For personal programs it needs to optionally link to `PersonalRoutineExercise`:
```prisma
model PerformedSet {
  ...
  routineExerciseId         String?  // make nullable for personal programs
  personalRoutineExerciseId String?  // new
  personalRoutineExercise   PersonalRoutineExercise? @relation(...)
}
```

---

### 16. ❌ No "Today's Workout" for Personal Programs

Same gap as point 11 but for personal programs.

```
GET /api/personal/programs/:programId/today
  → resolves day number from startDate, returns the PersonalRoutine for today
```

---

## Subscription Guard Summary

| Feature | Who Pays | Required Middleware |
|---------|----------|-------------------|
| Subscribe to a coach | Client | `requireSubscription()` ✅ already applied |
| View coach-assigned routines | Client | `requireSubscription()` ⚠️ missing |
| Start session from coach program | Client | `requireSubscription()` ⚠️ missing |
| Create personal program | Client | None (free feature) |
| Create personal routine/exercise | Client | None (free feature) |
| Log personal sets | Client | None (free feature) |
| Coach: create programs/routines | Coach | `requireCoach` (coach is the service provider, separate plan logic applies) |

---

## Implementation Priority Order

| Priority | Item | Blocker For |
|----------|------|-------------|
| 🔴 P0 | Add `coachId` to `Routine` schema | All coach routine management |
| 🔴 P0 | `POST /api/coach/routines` — create routine | Entire coach program build flow |
| 🔴 P0 | Fix ownership check in `addExerciseToRoutine` | Security |
| 🟠 P1 | `GET /api/coach/programs` + `GET /api/coach/programs/:id` | Coach can't review their own work |
| 🟠 P1 | `GET /api/coach/routines` | Reuse across programs |
| 🟠 P1 | `DELETE` + `PATCH` for ProgramRoutine junction | Day editing |
| 🟠 P1 | `DELETE` + `PATCH` for RoutineExercise junction | Exercise prescription editing |
| 🟡 P2 | Assignment management (view/revoke/update) | Coach client management |
| 🟡 P2 | Add `requireSubscription()` to coach-content client routes | Business rule enforcement |
| 🟡 P2 | Fix dead `routineId` field on `StartWorkoutSessionSchema` | Schema hygiene |
| 🟡 P2 | `GET /api/workout/today` | Scheduling / consistency rewards |
| 🔵 P3 | PersonalProgram/PersonalRoutine/PersonalRoutineExercise Prisma models | Entire personal flow |
| 🔵 P3 | All `/api/personal/*` endpoints | Personal flow |
| 🔵 P3 | `WorkoutSession` personal program linkage | Personal session tracking |
| 🔵 P3 | `PerformedSet` personal routine exercise linkage | Personal set attribution |
| 🔵 P3 | `GET /api/personal/programs/:id/today` | Personal scheduling |
