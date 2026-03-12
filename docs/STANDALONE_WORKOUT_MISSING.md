# Standalone Workout — Missing Server Implementation

> **Purpose**: Identifies all server-side gaps that prevent regular users (non-coaches, no subscription) from creating and managing their own programs, routines, and exercises **without** any coach involvement. Pose detection features are **excluded** from this scope — they remain coach-only.

---

## Executive Summary

The current server architecture assumes **all content creation flows through coaches**. Every `Program`, `Routine`, and `Exercise` (when privately owned) requires a `coachId`. Client-facing routes that read this content (`GET /routines`, `GET /today`, `POST /sessions`) are gated behind `requireSubscription()`. There is **no path** for a free, unsubscribed user to build their own workout programs and train independently.

This document details the schema changes, new endpoints, middleware adjustments, and controller logic needed to support a full standalone workout system.

---

## Table of Contents

- [1. Prisma Schema Changes](#1-prisma-schema-changes)
- [2. New API Endpoints](#2-new-api-endpoints)
- [3. Middleware Changes](#3-middleware-changes)
- [4. Controller Logic](#4-controller-logic)
- [5. Schema (Zod) Validation](#5-schema-zod-validation)
- [6. Route Registration](#6-route-registration)
- [7. Existing Endpoint Adjustments](#7-existing-endpoint-adjustments)
- [8. Out of Scope](#8-out-of-scope)
- [9. Implementation Checklist](#9-implementation-checklist)

---

## 1. Prisma Schema Changes

### 1.1 `Exercise` Model — Add `userId`

Currently `Exercise.coachId` is nullable and `isPublic` controls visibility. Users need to create **private exercises** they own.

**Current:**

```prisma
model Exercise {
  id        String  @id @default(cuid())
  coachId   String?
  coach     Coach?  @relation(fields: [coachId], references: [id], onDelete: SetNull)
  isPublic  Boolean @default(true)
  ...
}
```

**Required change — add `userId`:**

```prisma
model Exercise {
  id        String  @id @default(cuid())
  coachId   String?
  coach     Coach?  @relation(fields: [coachId], references: [id], onDelete: SetNull)
  userId    String?
  user      User?   @relation("UserExercises", fields: [userId], references: [id], onDelete: Cascade)
  isPublic  Boolean @default(true)
  ...
}
```

**Rule**: An exercise is either `coachId`-owned (coach content), `userId`-owned (personal content), or public (`isPublic: true`, both nulls). An exercise cannot have both `coachId` and `userId` set.

### 1.2 `Routine` Model — Make `coachId` Optional, Add `userId`

**Current:** `coachId` is **required** (`String`, not `String?`).

```prisma
model Routine {
  id      String @id @default(cuid())
  coachId String
  coach   Coach  @relation(fields: [coachId], references: [id], onDelete: Cascade)
  ...
}
```

**Required change:**

```prisma
model Routine {
  id      String  @id @default(cuid())
  coachId String?
  coach   Coach?  @relation(fields: [coachId], references: [id], onDelete: Cascade)
  userId  String?
  user    User?   @relation("UserRoutines", fields: [userId], references: [id], onDelete: Cascade)
  ...
}
```

**Rule**: Exactly one of `coachId` or `userId` must be set (enforced at the application layer or via a Prisma `@@check` constraint if supported).

### 1.3 `Program` Model — Make `coachId` Optional, Add `userId`

**Current:** `coachId` is **required**.

```prisma
model Program {
  id          String @id @default(cuid())
  coachId     String
  coach       Coach  @relation(fields: [coachId], references: [id], onDelete: Cascade)
  ...
}
```

**Required change:**

```prisma
model Program {
  id          String  @id @default(cuid())
  coachId     String?
  coach       Coach?  @relation(fields: [coachId], references: [id], onDelete: Cascade)
  userId      String?
  user        User?   @relation("UserPrograms", fields: [userId], references: [id], onDelete: Cascade)
  ...
}
```

**Rule**: Exactly one of `coachId` or `userId` must be set. `customForUserId` remains coach-only (one-off programs a coach builds for a specific client).

### 1.4 `User` Model — Add Relations

Add the reverse relations to the `User` model:

```prisma
model User {
  ...
  exercises       Exercise[]       @relation("UserExercises")
  routines        Routine[]        @relation("UserRoutines")
  programs        Program[]        @relation("UserPrograms")
}
```

### 1.5 `AssignedProgram` — No Schema Change Needed

`AssignedProgram` already references `userId` and `programId`. Standalone users will self-assign their own programs using the same model. No structural change is required — only new controller logic to allow self-assignment.

### 1.6 Migration

A new Prisma migration is required:

- Make `Routine.coachId` nullable (was required)
- Make `Program.coachId` nullable (was required)
- Add `Exercise.userId` (nullable FK → `User.id`)
- Add `Routine.userId` (nullable FK → `User.id`)
- Add `Program.userId` (nullable FK → `User.id`)

**Data migration note**: All existing routines and programs have a `coachId` set, so making those columns nullable is backward-compatible. No data backfill needed.

---

## 2. New API Endpoints

All new endpoints are mounted under `/api/standalone` and require `authenticateSupabaseUser` + `requireAppUser` only — **no** `requireCoach` and **no** `requireSubscription`.

### 2.1 Personal Exercise CRUD

| Method   | Endpoint                        | Description                                 | Auth       |
| -------- | ------------------------------- | ------------------------------------------- | ---------- |
| `POST`   | `/api/standalone/exercises`     | Create a personal exercise (`userId` owned) | Yes (user) |
| `GET`    | `/api/standalone/exercises`     | List user's exercises + public exercises    | Yes (user) |
| `PATCH`  | `/api/standalone/exercises/:id` | Update own exercise (ownership enforced)    | Yes (user) |
| `DELETE` | `/api/standalone/exercises/:id` | Delete own exercise (ownership enforced)    | Yes (user) |

**Notes:**

- `GET` returns the union of the user's private exercises and all public exercises (same visibility logic as existing `getExercises`, but scoped to `userId` instead of `coachId`).
- Create sets `userId` to the authenticated user's app ID and `isPublic: false` by default.
- Users cannot modify public or coach-owned exercises.

### 2.2 Personal Routine CRUD

| Method   | Endpoint                                              | Description                                   | Auth       |
| -------- | ----------------------------------------------------- | --------------------------------------------- | ---------- |
| `POST`   | `/api/standalone/routines`                            | Create a personal routine                     | Yes (user) |
| `GET`    | `/api/standalone/routines`                            | List user's own routines (paginated)          | Yes (user) |
| `GET`    | `/api/standalone/routines/:routineId`                 | Get single routine with exercises             | Yes (user) |
| `PATCH`  | `/api/standalone/routines/:routineId`                 | Update routine metadata                       | Yes (user) |
| `DELETE` | `/api/standalone/routines/:routineId`                 | Delete routine (cascades RoutineExercise)     | Yes (user) |
| `POST`   | `/api/standalone/routines/:routineId/exercises`       | Add exercise to routine                       | Yes (user) |
| `PATCH`  | `/api/standalone/routines/:routineId/exercises/:reId` | Update exercise prescription (sets/reps/rest) | Yes (user) |
| `DELETE` | `/api/standalone/routines/:routineId/exercises/:reId` | Remove exercise from routine                  | Yes (user) |

**Notes:**

- Routine ownership is enforced via `routine.userId === appUser.id`.
- Users can add both public exercises and their own private exercises to routines.
- Users **cannot** add coach-private exercises (where `isPublic: false` and `coachId` is set and `userId` is null).

### 2.3 Personal Program CRUD

| Method   | Endpoint                                             | Description                              | Auth       |
| -------- | ---------------------------------------------------- | ---------------------------------------- | ---------- |
| `POST`   | `/api/standalone/programs`                           | Create a personal program                | Yes (user) |
| `GET`    | `/api/standalone/programs`                           | List user's own programs (paginated)     | Yes (user) |
| `GET`    | `/api/standalone/programs/:programId`                | Get program with full routine tree       | Yes (user) |
| `PATCH`  | `/api/standalone/programs/:programId`                | Update program name/description          | Yes (user) |
| `DELETE` | `/api/standalone/programs/:programId`                | Delete program (cascades ProgramRoutine) | Yes (user) |
| `POST`   | `/api/standalone/programs/:programId/routines`       | Assign user's routine to program day     | Yes (user) |
| `PATCH`  | `/api/standalone/programs/:programId/routines/:prId` | Update day number for program-routine    | Yes (user) |
| `DELETE` | `/api/standalone/programs/:programId/routines/:prId` | Remove routine from program              | Yes (user) |

**Notes:**

- Program ownership enforced via `program.userId === appUser.id`.
- Users can only assign **their own routines** (where `routine.userId === appUser.id`) to their programs.
- `customForUserId` is **not used** for standalone — that field remains coach-only.

### 2.4 Self-Assignment

| Method | Endpoint                                         | Description                               | Auth       |
| ------ | ------------------------------------------------ | ----------------------------------------- | ---------- |
| `POST` | `/api/standalone/programs/:programId/activate`   | Self-assign / activate a personal program | Yes (user) |
| `POST` | `/api/standalone/programs/:programId/deactivate` | Deactivate (set `isActive: false`)        | Yes (user) |
| `GET`  | `/api/standalone/programs/active`                | Get current active program assignment     | Yes (user) |

**Notes:**

- Creates an `AssignedProgram` row with `userId` = self, `startDate` = now (or user-provided), `isActive: true`.
- Only one active standalone assignment at a time (enforced; deactivate previous before activating new).
- Validates the program is owned by the user (`program.userId === appUser.id`).

### 2.5 Today's Workout (Standalone)

| Method | Endpoint                | Description                                 | Auth       |
| ------ | ----------------------- | ------------------------------------------- | ---------- |
| `GET`  | `/api/standalone/today` | Resolve today's routine from active program | Yes (user) |

**Notes:**

- Same day-cycling logic as existing `getTodayWorkout`, but:
  - Does **not** require subscription.
  - Queries for active `AssignedProgram` where the linked `Program.userId === appUser.id` (standalone programs only).
  - Excludes coach-assigned programs from this endpoint to avoid confusion.

### 2.6 Workout Sessions (Standalone — No Subscription)

| Method | Endpoint                                       | Description                       | Auth       |
| ------ | ---------------------------------------------- | --------------------------------- | ---------- |
| `POST` | `/api/standalone/sessions`                     | Start a session (no subscription) | Yes (user) |
| `GET`  | `/api/standalone/sessions/active`              | Get active session                | Yes (user) |
| `POST` | `/api/standalone/sessions/:sessionId/complete` | Complete session                  | Yes (user) |
| `GET`  | `/api/standalone/sessions`                     | List past sessions (paginated)    | Yes (user) |
| `GET`  | `/api/standalone/sessions/:sessionId`          | Get session detail with sets      | Yes (user) |

**Notes:**

- Mirrors the existing session endpoints but **without** `requireSubscription()`.
- `startWorkoutSession` accepts optional `assignedProgramId`; if provided, validates the assignment belongs to the user and the program is user-owned.
- Session uses the same `WorkoutSession` and `PerformedSet` tables — no schema change needed.
- Set logging (`POST /api/workout/sets`, `PUT`, `DELETE`, `POST /sets/sync`) already works without subscription — those endpoints only require `authenticateSupabaseUser`. **No change needed** for set logging endpoints.

### 2.7 Standalone Weekly Stats

| Method | Endpoint                       | Description                                | Auth       |
| ------ | ------------------------------ | ------------------------------------------ | ---------- |
| `GET`  | `/api/standalone/stats/weekly` | Weekly stats scoped to standalone sessions | Yes (user) |

**Notes:**

- Same aggregation logic as `getWeeklyStats` but can be served from the existing endpoint since it already only requires `authenticateSupabaseUser` with no subscription gate. Consider whether to reuse or keep separate for clarity.

---

## 3. Middleware Changes

### 3.1 No New Middleware Required

The existing middleware stack is sufficient:

| Middleware                 | Used For Standalone | Notes                                                      |
| -------------------------- | ------------------- | ---------------------------------------------------------- |
| `authenticateSupabaseUser` | ✅ Yes              | JWT validation, attaches `req.user`                        |
| `requireAppUser`           | ✅ Yes              | Resolves `supabaseId` → app `User`, attaches `req.appUser` |
| `requireCoach`             | ❌ Not used         | Standalone routes must NOT use this                        |
| `requireSubscription()`    | ❌ Not used         | Standalone routes must NOT use this                        |
| `validateRequest`          | ✅ Yes              | Zod validation, stores in `res.locals.validated`           |

### 3.2 Ownership Enforcement Pattern

No middleware needed — enforce in controllers:

```typescript
// Pattern for all standalone endpoints
const appUser = req.appUser; // from requireAppUser
const routine = await prisma.routine.findUnique({ where: { id: routineId } });

if (!routine || routine.userId !== appUser.id) {
  return sendSingleError(res, "Routine not found", 404);
}
```

Return `404` (not `403`) when ownership fails to avoid leaking resource existence.

---

## 4. Controller Logic

### 4.1 New File: `standalone.controller.ts`

Create `src/controllers/standalone.controller.ts` with all handlers for the standalone endpoints listed in [Section 2](#2-new-api-endpoints).

**Key differences from coach controller logic:**

| Concern               | Coach Controller                   | Standalone Controller                               |
| --------------------- | ---------------------------------- | --------------------------------------------------- |
| Owner field           | `coachId` (from `req.coach`)       | `userId` (from `req.appUser.id`)                    |
| Ownership check       | `resource.coachId === coach.id`    | `resource.userId === appUser.id`                    |
| Exercise visibility   | Public + own coach exercises       | Public + own user exercises                         |
| Routine-to-exercise   | Coach owns both routine + exercise | User owns routine; exercise is public or user-owned |
| Program assignment    | Coach assigns to client            | User self-assigns                                   |
| Subscription required | Client needs subscription          | No subscription needed                              |

### 4.2 Reusable Logic

Consider extracting shared logic into service functions in `src/services/workout.service.ts`:

- **Day-cycling resolution** — used by both `getTodayWorkout` (coach path) and standalone today endpoint.
- **Session lifecycle** — `startSession`, `completeSession`, `getActiveSession` logic is identical; only the subscription guard differs.
- **Weekly stats aggregation** — same query regardless of program ownership.

---

## 5. Schema (Zod) Validation

### 5.1 New File: `standalone.schema.ts`

Create `src/schemas/standalone.schema.ts` with Zod schemas for all standalone endpoints.

Many schemas mirror the existing program/workout schemas with minor differences:

| Schema                         | Based On                    | Differences                                                     |
| ------------------------------ | --------------------------- | --------------------------------------------------------------- |
| `CreatePersonalExerciseSchema` | `CreateExerciseSchema`      | No `coachId`; body adds `isPublic` (optional, defaults `false`) |
| `UpdatePersonalExerciseSchema` | `UpdateExerciseSchema`      | Same fields                                                     |
| `CreatePersonalRoutineSchema`  | `CreateRoutineSchema`       | No `coachId`                                                    |
| `UpdatePersonalRoutineSchema`  | `UpdateRoutineSchema`       | Same fields                                                     |
| `CreatePersonalProgramSchema`  | `CreateProgramSchema`       | No `coachId`, no `customForUserId`                              |
| `UpdatePersonalProgramSchema`  | `UpdateProgramSchema`       | Same fields                                                     |
| `ActivateProgramSchema`        | New                         | Body: `{ startDate?: string (ISO) }`                            |
| `AddExerciseToRoutineSchema`   | `addRoutineExerciseSchema`  | Same fields                                                     |
| `AssignRoutineToProgramSchema` | `AssignRoutineSchema`       | Same fields                                                     |
| `StartStandaloneSessionSchema` | `StartWorkoutSessionSchema` | Same fields (`assignedProgramId` optional)                      |
| All list/get-by-id schemas     | Existing equivalents        | Same pagination/param patterns                                  |

---

## 6. Route Registration

### 6.1 New File: `standalone.routes.ts`

Create `src/routes/standalone.routes.ts` wiring all endpoints from [Section 2](#2-new-api-endpoints) with:

- `authenticateSupabaseUser`
- `requireAppUser`
- `validateRequest(...)` per route
- Controller handlers from `standalone.controller.ts`

### 6.2 Mount in `index.ts`

```typescript
import standaloneRoutes from "./routes/standalone.routes";

app.use("/api/standalone", standaloneRoutes);
```

---

## 7. Existing Endpoint Adjustments

### 7.1 `GET /api/workout/exercises` — Extend Visibility Filter

Currently shows public exercises + coach's private exercises. After schema changes, also include the user's own private exercises:

```typescript
// Current
const visibilityFilter = coachId
  ? { OR: [{ isPublic: true }, { coachId }] }
  : { isPublic: true };

// Updated — also include user-owned exercises
const visibilityFilter = coachId
  ? {
      OR: [
        { isPublic: true },
        { coachId },
        ...(appUserId ? [{ userId: appUserId }] : []),
      ],
    }
  : { OR: [{ isPublic: true }, ...(appUserId ? [{ userId: appUserId }] : [])] };
```

### 7.2 Set Logging Endpoints — No Change Needed

`POST /api/workout/sets`, `PUT /api/workout/sets/:setId`, `DELETE /api/workout/sets/:setId`, and `POST /api/workout/sets/sync` already only require `authenticateSupabaseUser` (no subscription gate). Standalone sessions can use these directly.

### 7.3 `GET /api/workout/stats/weekly` — No Change Needed

Already only requires `authenticateSupabaseUser`. Works for all sessions regardless of program type.

### 7.4 `GET /api/workout/sessions/*` — Partial Adjustment

- `GET /api/workout/sessions` (history) — already no subscription. ✅ No change.
- `GET /api/workout/sessions/:sessionId` — already no subscription. ✅ No change.
- `GET /api/workout/sessions/active` — already no subscription. ✅ No change.
- `POST /api/workout/sessions/:sessionId/complete` — already no subscription. ✅ No change.
- `POST /api/workout/sessions` (start) — **has `requireSubscription()`**. This must remain for coach-assigned program sessions. Standalone sessions use the new `/api/standalone/sessions` endpoint instead.

---

## 8. Out of Scope

The following features are **explicitly excluded** from the standalone workout system:

| Feature                    | Reason                                                      |
| -------------------------- | ----------------------------------------------------------- |
| Pose Detection             | Requires coach-uploaded reference forms; remains coach-only |
| Form Analysis              | Depends on ExercisePoseConfig / ExerciseForm (coach-owned)  |
| Limb Isolation Config      | Coach-managed per-exercise body segment config              |
| Coach Dashboard Access     | Standalone users are not coaches                            |
| Client Assignment by Coach | Coach workflow; standalone is self-service                  |
| Subscription / Payments    | Standalone is free; no plan or payment integration needed   |
| Promo Codes                | No subscription means no discount codes                     |
| `customForUserId` Programs | Coach feature for building one-off programs for clients     |

---

## 9. Implementation Checklist

### Phase 1: Schema & Migration

- [ ] Add `userId` (nullable FK → `User.id`) to `Exercise` model
- [ ] Make `Routine.coachId` nullable, add `userId` (nullable FK → `User.id`)
- [ ] Make `Program.coachId` nullable, add `userId` (nullable FK → `User.id`)
- [ ] Add reverse relations (`UserExercises`, `UserRoutines`, `UserPrograms`) to `User` model
- [ ] Generate and apply Prisma migration
- [ ] Verify existing coach data is unaffected (all existing rows keep `coachId`)

### Phase 2: Zod Schemas

- [ ] Create `src/schemas/standalone.schema.ts`
- [ ] Define schemas for personal exercise CRUD (create, update, delete, list, get-by-id)
- [ ] Define schemas for personal routine CRUD + exercise management
- [ ] Define schemas for personal program CRUD + routine assignment
- [ ] Define schemas for self-assignment (activate, deactivate, get-active)
- [ ] Define schemas for standalone today's workout
- [ ] Define schemas for standalone sessions (start, complete, list, get-by-id)

### Phase 3: Controller

- [ ] Create `src/controllers/standalone.controller.ts`
- [ ] Implement personal exercise CRUD (create with `userId`, ownership checks)
- [ ] Implement personal routine CRUD (create with `userId`, ownership checks)
- [ ] Implement routine-exercise management (add/update/remove exercises in own routines)
- [ ] Implement personal program CRUD (create with `userId`, ownership checks)
- [ ] Implement program-routine management (assign/update/remove own routines in own programs)
- [ ] Implement self-assignment (activate/deactivate personal programs)
- [ ] Implement standalone today's workout (day-cycling, scoped to user-owned programs)
- [ ] Implement standalone session lifecycle (start/complete/list/get without subscription)

### Phase 4: Routes & Registration

- [ ] Create `src/routes/standalone.routes.ts`
- [ ] Wire all endpoints with `authenticateSupabaseUser` + `requireAppUser` + `validateRequest`
- [ ] Mount `/api/standalone` in `src/index.ts`

### Phase 5: Existing Code Updates

- [ ] Update `getExercises` visibility filter to include user-owned exercises
- [ ] Add application-layer validation: exactly one of `coachId` / `userId` on `Exercise`, `Routine`, `Program`
- [ ] Verify set logging, stats, and session history endpoints still work for standalone sessions

### Phase 6: Documentation

- [ ] Create `docs/features/STANDALONE_WORKOUT.md` feature doc
- [ ] Update `docs/FEATURE_INDEX.md` with standalone workout section
- [ ] Update `docs/CONTEXT.md` if new patterns are introduced

### Phase 7: Testing

- [ ] Test personal exercise CRUD (create, list, update, delete, visibility)
- [ ] Test personal routine CRUD + exercise management
- [ ] Test personal program CRUD + routine assignment
- [ ] Test self-assignment flow (activate, deactivate, single-active constraint)
- [ ] Test standalone today's workout (day cycling with user-owned program)
- [ ] Test standalone session start without subscription
- [ ] Test set logging against standalone routine exercises
- [ ] Test that coach endpoints are unaffected (ownership isolation)
- [ ] Test that subscription-gated endpoints still require subscription for coach content
