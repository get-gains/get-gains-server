# Schema Migration Dependency Map

This document is the **input to Phase 2** of the schema redesign. Phase 1 rewrote `prisma/schema.prisma` per the new design and regenerated the Prisma client. Every TypeScript file in `server/src/` that touches the database is now broken — this document enumerates what changed, why, and the order in which to fix it.

> **Companion documents**
>
> - [`schema-design-rationale.md`](./schema-design-rationale.md) — _why_ each design decision was made
> - [`proposed_schema.md`](./proposed_schema.md) — the source-of-truth field listing
> - This file — _what is broken and how to fix it_

The new schema uses **snake_case** model and field names throughout (e.g. `prisma.user`, `user.supabase_auth_id`, `prisma.subscription_plan`). Phase 2 must rename every Prisma access in `src/` to match.

---

## Section A — Renaming & Removal Reference

### Removed models (delete all references)

| Old model                      | Disposition                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `UserProfile`                  | Fields flattened onto `user`.                                                                                                              |
| `CoachSettings`                | Fields flattened onto `coach`.                                                                                                             |
| `Plan`                         | Replaced by `subscription_plan` (catalog) + `provider_plan` (provider satellite).                                                          |
| `PromoCode`, `PromoRedemption` | Removed entirely. Promo codes are managed by Google Play / Apple. Use `subscription.is_discounted` + `discount_description` for analytics. |
| `ExercisePoseConfig`           | `activeSegments` merged into `exercise.active_segments`. All other config fields dropped (live in S3 payload now).                         |
| `ProgramRoutine`               | Removed at the template level. Linkage exists only in `assigned_program_routine`.                                                          |
| `RoutineExercise`              | Removed at the template level. Linkage exists only in `assigned_program_routine_exercise`.                                                 |
| `FormComparisonResult`         | Removed entirely. Per-set scoring lives on `performed_set.overall_score` + `recorded_frames_key`.                                          |
| `CoinBalance`                  | Denormalized into `user.coin_balance`. The ledger (`coin_transactions`) remains the source of truth.                                       |
| `EquippedCosmetic`             | Folded into `user_cosmetic.equipped_at` (non-null = equipped).                                                                             |
| `EconomyConfig`                | Removed. Move tunables to env vars or constants.                                                                                           |

### Renamed models (table name → table name)

| Old model (PascalCase) | New model (snake_case)              |
| ---------------------- | ----------------------------------- |
| `User`                 | `user`                              |
| `Coach`                | `coach`                             |
| `SubscribedCoach`      | `subscribed_coach`                  |
| `Program`              | `program`                           |
| `Routine`              | `routine`                           |
| `Exercise`             | `exercise`                          |
| `ExerciseForm`         | `exercise_form`                     |
| `AssignedProgram`      | `assigned_program`                  |
| (new)                  | `assigned_program_routine`          |
| (new)                  | `assigned_program_routine_exercise` |
| `WorkoutSession`       | `workout_session`                   |
| `PerformedSet`         | `performed_set`                     |
| `Cosmetic`             | `cosmetics`                         |
| `UserCosmetic`         | `user_cosmetic`                     |
| `CoinTransaction`      | `coin_transactions`                 |
| `Subscription`         | `subscription`                      |
| `SubscriptionEvent`    | `subscription_event`                |
| `WebhookEvent`         | `webhook_event`                     |
| `PaymentHistory`       | `payment_history`                   |
| (new)                  | `subscription_plan`                 |
| (new)                  | `provider_plan`                     |
| (new)                  | `subscription_plan_history`         |
| (new)                  | `partner`                           |
| (new)                  | `mission`                           |
| (new)                  | `user_mission`                      |
| (new)                  | `raffle_entry`                      |

### Renamed / new fields (the high-impact ones)

| Old                                                                                                                                                                                                          | New                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `User.id` (cuid)                                                                                                                                                                                             | `user.supabase_auth_id` (PK + every FK)                                                                                                                                        |
| `User.name`                                                                                                                                                                                                  | `user.full_name`                                                                                                                                                               |
| `User.supabaseId`                                                                                                                                                                                            | dropped — `supabase_auth_id` IS the PK                                                                                                                                         |
| `UserProfile.bio` / `avatarUrl` / `heightCm` / `weightKg` / `sex` / `dateOfBirth` / `equipment` / `experienceLevel`                                                                                          | `user.bio` / `avatar_key` / `height_cm` / `weight_kg` / `sex` / `date_of_birth` / `equipment_available` / `experience_level`                                                   |
| `UserProfile.daysAvailable` / `sessionDurationMinutes` / `unitPreference` / `injuryHistory`                                                                                                                  | **dropped**                                                                                                                                                                    |
| `Coach.name` / `email` / `avatarUrl` / `bio`                                                                                                                                                                 | live on `user` (joined via `coach.user_id`)                                                                                                                                    |
| `Coach.yearsExperience` / `awards` / `certificationImageUrls` / `isVerified`                                                                                                                                 | **dropped**                                                                                                                                                                    |
| `CoachSettings.maxClients` / `acceptingClients` / `isDiscoverable`                                                                                                                                           | `coach.max_clients` / `accepting_clients` / `is_discoverable`                                                                                                                  |
| `Plan.id`                                                                                                                                                                                                    | `subscription_plan.id`                                                                                                                                                         |
| `Plan.priceCents` / `currency` / `billingCycle` / `features` / `tierLevel` / `trialPeriodDays` / `isActive` / `sortOrder`                                                                                    | `subscription_plan.*` (same names in snake_case)                                                                                                                               |
| `Plan.provider` / `productId`                                                                                                                                                                                | `provider_plan.provider` / `provider_product_id`                                                                                                                               |
| `Plan.googleSubscriptionId` / `googleBasePlanId`                                                                                                                                                             | `provider_plan.provider_subscription_id` / `provider_base_plan_id`                                                                                                             |
| `Subscription.subscriptionId` (external)                                                                                                                                                                     | `subscription.external_subscription_id`                                                                                                                                        |
| `Subscription.planId`                                                                                                                                                                                        | `subscription.subscription_plan_id`                                                                                                                                            |
| `Subscription.metadata`                                                                                                                                                                                      | `subscription.provider_metadata`                                                                                                                                               |
| (new)                                                                                                                                                                                                        | `subscription.is_discounted`, `discount_description`                                                                                                                           |
| `PaymentHistory.orderId @unique`                                                                                                                                                                             | `payment_history.provider_order_id` (composite UNIQUE with `subscription_id`)                                                                                                  |
| `PaymentHistory.receiptData`                                                                                                                                                                                 | **dropped** (lives in `webhook_event.raw_payload`)                                                                                                                             |
| (new)                                                                                                                                                                                                        | `payment_history.refund_amount_cents` (was `refundAmount`)                                                                                                                     |
| `WebhookEvent.processedAt`                                                                                                                                                                                   | `webhook_event.processed_at` (now NULLABLE — set only on COMPLETED)                                                                                                            |
| (new)                                                                                                                                                                                                        | `webhook_event.idempotency_key UNIQUE`                                                                                                                                         |
| `SubscriptionEvent.eventType` (enum)                                                                                                                                                                         | `subscription_event.event_type` (free `String`)                                                                                                                                |
| (new)                                                                                                                                                                                                        | `subscription_event.webhook_event_id` (links state change to triggering webhook)                                                                                               |
| `Program.coachId` / `customForUserId`                                                                                                                                                                        | dropped — only `program.user_id`                                                                                                                                               |
| `Routine.coachId`                                                                                                                                                                                            | dropped — only `routine.user_id`                                                                                                                                               |
| `Routine.muscleGroupsTargeted`                                                                                                                                                                               | **dropped**                                                                                                                                                                    |
| `Exercise.coachId`                                                                                                                                                                                           | dropped — only `exercise.user_id`                                                                                                                                              |
| `Exercise.primaryMuscleGroup` / `equipmentNeeded`                                                                                                                                                            | **dropped**                                                                                                                                                                    |
| `Exercise.targetMuscles` (enum array)                                                                                                                                                                        | `exercise.target_muscles` (`String[]`)                                                                                                                                         |
| (new)                                                                                                                                                                                                        | `exercise.active_segments String[]` (merged from `ExercisePoseConfig`)                                                                                                         |
| `ExerciseForm.landmarkFrames` / `featureFrames` / `normalizedFrames` / `relevantAngles` / `durationMs` / `frameRate` / `totalFrames` / `version` / `isActive` / `avgLandmarkConfidence` / `recordingQuality` | **all dropped** — replaced by `exercise_form.recorded_frames_key` (S3)                                                                                                         |
| `ExerciseForm.coachId`                                                                                                                                                                                       | **dropped** — ownership flows through `exercise.user_id`                                                                                                                       |
| `ProgramRoutine.dayNumber`                                                                                                                                                                                   | `assigned_program_routine.days_of_week` (`String[]`)                                                                                                                           |
| `WorkoutSession.userId`                                                                                                                                                                                      | dropped — reachable via `assigned_program_routine → assigned_program → user_id` (2 hops)                                                                                       |
| `WorkoutSession.assignedProgramId`                                                                                                                                                                           | `workout_session.assigned_program_routine_id` (different FK target)                                                                                                            |
| `WorkoutSession.notes`                                                                                                                                                                                       | `workout_session.feedback`                                                                                                                                                     |
| `PerformedSet.routineExerciseId`                                                                                                                                                                             | `performed_set.assigned_program_routine_exercise_id`                                                                                                                           |
| `PerformedSet.setNumber` / `repsCompleted` / `weightKg` / `rpe` / `notes`                                                                                                                                    | `performed_set.set_number` / `reps` / `weight` / **dropped** / **dropped**                                                                                                     |
| (new)                                                                                                                                                                                                        | `performed_set.overall_score Int`, `recorded_frames_key String?`, `completed_at` (required)                                                                                    |
| `Cosmetic.coinCost` / `unityAssetRef` / `previewImageUrl` / `status`                                                                                                                                         | `cosmetics.price` / **dropped** / `preview_image_key` / replaced by `deleted_at`                                                                                               |
| `EquippedCosmetic.equippedAt`                                                                                                                                                                                | `user_cosmetic.equipped_at` (non-null = equipped)                                                                                                                              |
| `CoinBalance.currentBalance`                                                                                                                                                                                 | `user.coin_balance`                                                                                                                                                            |
| `CoinBalance.lifetimeEarned` / `lifetimeSpent`                                                                                                                                                               | **dropped** — recompute from ledger if needed                                                                                                                                  |
| `CoinTransaction.amount`                                                                                                                                                                                     | `coin_transactions.value`                                                                                                                                                      |
| `CoinTransaction.balanceAfter` (already existed)                                                                                                                                                             | `coin_transactions.balance_after` (still required)                                                                                                                             |
| All `CoinTransaction` breakdown columns                                                                                                                                                                      | retained as `set_coins`, `accuracy_multiplier`, `completion_bonus`, `duration_bonus`, `streak_bonus`, `streak_value`, `sets_completed`, `avg_accuracy`, `session_duration_min` |
| `CoinTransaction.userCosmeticId` (single FK)                                                                                                                                                                 | `coin_transactions.user_cosmetic_user_id` + `user_cosmetic_cosmetic_id` (composite FK to the new composite-PK `user_cosmetic`)                                                 |

### Removed enums

`Sex`, `ExperienceLevel`, `MuscleGroup`, `TargetMuscle`, `DiscountType`, `SubscriptionEventType`, `CosmeticCategory`, `CosmeticStatus`, `PaymentProvider`. The first four become free `String` (`equipment_available`, `target_muscles`, etc. are `String[]`); enums tracking provider event types are now `String`; `CosmeticCategory` becomes `String`; `CosmeticStatus` is replaced by `cosmetics.deleted_at`. `PaymentProvider` is replaced by **`Provider`** (`GOOGLE_PLAY`, `APPLE`).

### Retained enums

`BillingCycle`, `SubscriptionStatus` (added `PAUSED`), `PaymentStatus` (added `REFUNDED`), `WebhookStatus`, `CameraAngle`, `BodySegment`, `CoinTransactionType`, plus the new `Provider`.

---

## Section B — Behavioral Changes (logic, not just renames)

These are the changes that require **rewriting business logic**, not just renaming a Prisma call.

### B1. Auth middleware hot path

**Files:** `src/middleware/auth.middleware.ts`, `src/middleware/subscription.middleware.ts`, `src/types/express.d.ts`

- `req.appUser` is now the flat `user` shape (no `.profile` nesting). Anywhere that read `req.appUser.profile.heightCm` becomes `req.appUser.height_cm`.
- Subscription check must hit the new composite index: `WHERE user_id = ? AND status = 'ACTIVE' AND current_period_end > now()`. The query plan is now an index-only scan on `(user_id, status, current_period_end)`.
- Tier-level reads must join through `subscription.subscription_plan_id` → `subscription_plan.tier_level`. The current `subscription.subscription_plan_id` always holds the _current_ plan (the SCD2 history table is for audit, not hot reads).
- `req.user.subscription` envelope (`{ isSubscribed, tierLevel, ... }`) shape stays the same — only the underlying query changes.
- `is_coach` check now reads `req.appUser.is_coach` directly (a column on `user`), no join to `coach`.

### B2. Coin economy: atomic balance + ledger

**Files:** `src/services/coin-calculation.service.ts`, `src/utils/streak.ts`, `src/controllers/coins.controller.ts`, `src/controllers/cosmetics.controller.ts`, `src/controllers/shop.controller.ts`, `src/controllers/workout.controller.ts`

- Every coin write must become an atomic transaction:
  ```ts
  await prisma.$transaction(async (tx) => {
    const u =
      await tx.$queryRaw`SELECT coin_balance FROM "user" WHERE supabase_auth_id = ${userId} FOR UPDATE`;
    const newBalance = u[0].coin_balance + delta;
    await tx.coin_transactions.create({
      data: {
        user_id: userId,
        value: delta,
        balance_after: newBalance,
        ...breakdown,
      },
    });
    await tx.user.update({
      where: { supabase_auth_id: userId },
      data: { coin_balance: newBalance },
    });
  });
  ```
- The `SELECT ... FOR UPDATE` row lock prevents two concurrent earns from clobbering each other.
- `balance_after` must be computed inside the transaction (post-update value).
- The `CHECK (coin_balance >= 0)` constraint mentioned in the rationale is **not yet** in the schema — application code must reject overspending before the DB write. (Optional follow-up: add the constraint via raw SQL migration.)
- All `EconomyConfig` reads in `coin-calculation.service.ts` must become env-var or constant lookups. The current keys to migrate: enumerate them by grepping for `economyConfig.findUnique` and document the new constant names.

### B3. Webhook processing & idempotency

**Files:** `src/services/subscription.service.ts`, `src/providers/payment/index.ts` (and any provider sub-modules), `src/controllers/subscription.controller.ts`

- Inbound webhook handler must:
  1. Compute `idempotency_key` (Google Pub/Sub `messageId` for Google Play; Apple uses `notificationUUID`).
  2. `findUnique` on `webhook_event.idempotency_key`. If exists with `status = 'COMPLETED'`, return 200 immediately.
  3. Otherwise insert the row with `status = 'PENDING'` and `processed_at = NULL`.
  4. Process the event. On success, `update` the row to `status = 'COMPLETED'` and `processed_at = now()`. On failure, increment `retry_count` and set `status = 'FAILED'`, `error_message`.
- Every state change that mutates `subscription.status` must also write a `subscription_event` row with `webhook_event_id` populated, `from_status`, `to_status`, `triggered_by = 'webhook'`.
- A retry queue cron / job can scan `WHERE status = 'FAILED' AND retry_count < N` (uses `(status, created_at)` index).

### B4. Subscription plan changes (SCD2)

**Files:** `src/services/subscription.service.ts`

- When `subscription.subscription_plan_id` changes (upgrade/downgrade/initial), inside the same transaction:
  1. Close the previous history row: `UPDATE subscription_plan_history SET effective_until = now() WHERE subscription_id = ? AND effective_until IS NULL`.
  2. Insert a new history row with `effective_from = now()`, `effective_until = NULL`, and `change_reason` (`'initial'`, `'upgrade'`, `'downgrade'`).
  3. Update `subscription.subscription_plan_id` to the new plan.
- Initial subscription creation also inserts a history row with `change_reason = 'initial'`.

### B5. Payment idempotency (composite key)

**Files:** `src/services/subscription.service.ts`

- The old `payment_history.orderId @unique` check (`prisma.paymentHistory.findUnique({ where: { orderId } })`) becomes:
  ```ts
  prisma.payment_history.findUnique({
    where: {
      subscription_id_provider_order_id: { subscription_id, provider_order_id },
    },
  });
  ```
- Google Play renewal suffixes (`GPA.1234..0`, `GPA.1234..1`) now coexist within different subscriptions without collision.
- Drop all writes to `receiptData`. The raw payload lives only in `webhook_event.raw_payload`.

### B6. Promo code surface — delete entirely

**Files:** `src/controllers/promo.controller.ts`, `src/services/promo.service.ts`, `src/schemas/promo.schema.ts`, `src/routes/promo.routes.ts` (or wherever it is mounted)

- Delete all four files.
- Remove the `app.use('/promo', promoRoutes)` mount in `src/index.ts` (or wherever routes are wired).
- Audit `subscription.controller.ts` and `subscription.service.ts` for any code that called `promoService` and remove those branches. New subscriptions no longer apply promos server-side; the client purchase flow gets the discount directly from the provider.
- For analytics, set `subscription.is_discounted` and `discount_description` from the webhook payload when the provider reports a discounted purchase.

### B7. Form comparison — delete + S3 path

**Files:** `src/controllers/pose.controller.ts`, `src/schemas/pose.schema.ts`, `src/services/leaderboard.service.ts` (if it aggregates over `formComparisonResult`)

- Delete all `FormComparisonResult` Prisma calls. The endpoint that POSTed comparison results is gone; the client now writes scores into `performed_set.overall_score` (and optionally `recorded_frames_key` to S3) when completing a set.
- Coach form upload (`exercise_form` create) must change shape:
  - The endpoint accepts a single S3 key (`recorded_frames_key`) instead of three JSON columns.
  - Upload flow: client requests a pre-signed PUT URL → uploads landmark JSON to S3 → POSTs the resulting key to the server → server inserts the `exercise_form` row.
  - Drop `durationMs`, `frameRate`, `totalFrames`, `version`, `isActive`, `relevantAngles`, `avgLandmarkConfidence`, `recordingQuality`, `featureFrames`, `normalizedFrames`, `landmarkFrames` from the schema and from request validation.
- `ExercisePoseConfig` endpoints disappear. The `active_segments` array now comes from `exercise.active_segments` directly (set when the exercise is created).

### B8. Equipped cosmetics — application-level "one per category"

**Files:** `src/controllers/cosmetics.controller.ts`

- Equip:
  ```ts
  await prisma.$transaction([
    prisma.user_cosmetic.updateMany({
      where: { user_id, equipped_at: { not: null }, cosmetic: { category } },
      data: { equipped_at: null },
    }),
    prisma.user_cosmetic.update({
      where: { user_id_cosmetic_id: { user_id, cosmetic_id } },
      data: { equipped_at: new Date() },
    }),
  ]);
  ```
- Unequip: set `equipped_at = null`.
- The composite PK `(user_id, cosmetic_id)` replaces the old surrogate-`id` column. All Prisma `where` clauses must use the `user_id_cosmetic_id` compound key.
- The "one equipped per category" rule is now enforced in code, not in the DB. (Optional follow-up: add a partial unique index `CREATE UNIQUE INDEX ON user_cosmetic (user_id, /* derived category */) WHERE equipped_at IS NOT NULL`.)

### B9. Program assignment — snapshot pattern

**Files:** `src/controllers/program.controller.ts`, `src/controllers/standalone.controller.ts`, possibly a new `src/services/assignment.service.ts`

- The act of assigning a program now requires the coach (or auto-assign flow) to provide the _full prescription tree_ at assign-time:
  ```
  POST /assigned-programs
  {
    program_id, user_id, start_date, end_date, notes,
    routines: [
      {
        routine_id, days_of_week: ['MONDAY', 'WEDNESDAY'],
        exercises: [
          { exercise_id, sets, reps_min, reps_max, rest_seconds, order_in_routine },
          ...
        ]
      },
      ...
    ]
  }
  ```
- The handler creates `assigned_program` + `assigned_program_routine` rows + `assigned_program_routine_exercise` rows in a single transaction.
- Templates (`program`, `routine`, `exercise`) have **no template-level junctions**. They are name-only entities at the template level. The coach UI must keep the prescription state in client memory until assignment, or use a draft mechanism (out of scope for this redesign).

### B10. Coach identity reads

**Files:** any controller that returned coach profile data (`coach.controller.ts`, `class.controller.ts`, `leaderboard.service.ts`, etc.)

- `coach` no longer has `name`, `email`, `avatarUrl`, `bio`. These live on the joined `user` row. Every `prisma.coach.findUnique` that needed identity must now `include: { user: true }` and read `coach.user.full_name`, `coach.user.email`, `coach.user.avatar_key`, `coach.user.bio`.
- `coach.yearsExperience`, `awards`, `certificationImageUrls`, `isVerified` are gone. Any UI / response shape that exposed them must drop those fields. Confirm with product before deleting endpoint payload fields visible to the mobile app.

### B11. WorkoutSession is no longer user-rooted directly

**Files:** `src/controllers/workout.controller.ts`, `src/controllers/sessions.controller.ts`, `src/controllers/stats.controller.ts`, `src/services/leaderboard.service.ts`

- `workout_session.user_id` no longer exists. Listing a user's sessions now requires:
  ```ts
  prisma.workout_session.findMany({
    where: { assigned_program_routine: { assigned_program: { user_id: userId } } },
    ...
  });
  ```
- Stats aggregations (e.g., total workouts per user, average duration) become more expensive. Consider adding a denormalized `user_id` column on `workout_session` later if profiling shows it matters; for now, follow the relational path.
- "Standalone" workouts (not tied to an assigned program) are **no longer possible** under this schema — every workout must belong to an `assigned_program_routine`. If the product still needs ad-hoc workouts, the assignment flow must auto-create a one-off `assigned_program` for the user. Confirm with product.

### B12. `req.appUser` typing

**Files:** `src/types/express.d.ts`, `src/middleware/auth.middleware.ts`

- The Express type augmentation that declares `req.appUser` must change from `User & { profile: UserProfile }` to the new flat `user` model type imported from `@prisma/client`.
- Anywhere reading `req.appUser.id` becomes `req.appUser.supabase_auth_id`.
- Anywhere reading `req.appUser.profile.*` becomes `req.appUser.*`.

### B13. EconomyConfig removal

**Files:** `src/services/coin-calculation.service.ts`, possibly an admin endpoint that wrote `EconomyConfig`

- Replace every `prisma.economyConfig.findUnique` / `findMany` with constant lookups.
- Suggested: a single `src/config/economy.ts` exporting strongly-typed constants (`SET_COIN_BASE`, `ACCURACY_MULTIPLIER_CAP`, `COMPLETION_BONUS`, `DURATION_BONUS_PER_MINUTE`, `STREAK_BONUS_TIERS`, etc.). Phase 2 must enumerate the existing keys and port them.
- Delete any admin route that mutated `EconomyConfig`.

### B14. Sync plans script

**Files:** `server/scripts/sync-plans.ts`, `src/services/subscription.service.ts::syncPlansFromProviders`

- The script now writes to **two** tables: `subscription_plan` (catalog) and `provider_plan` (Google Play satellite row).
- Matching logic: for each Google Play subscription, upsert the `subscription_plan` by `name`, then upsert the `provider_plan` by composite `(provider, provider_product_id)`.
- Apple support is now structurally possible — a separate sync job can target the same `subscription_plan` rows by name.

---

## Section C — File-by-File Impact

Grouped by domain. ✏️ = needs editing, 🗑️ = delete entirely, ➕ = new file likely needed.

### Identity / profile

- ✏️ `src/middleware/auth.middleware.ts` — `User` → `user`, drop `UserProfile` join, fix `is_coach` read, fix subscription envelope query.
- ✏️ `src/middleware/subscription.middleware.ts` — composite-index query, `Plan` → `subscription_plan`, drop `Subscription.planId`.
- ✏️ `src/types/express.d.ts` — `req.appUser` shape change.
- ✏️ `src/controllers/auth.controller.ts` — drop UserProfile creation; create `user` row directly with all fields.
- ✏️ `src/controllers/user.controller.ts` — same flatten.
- ✏️ `src/controllers/profile.controller.ts` — flatten profile reads/writes onto `user`. Possibly delete if it becomes a thin wrapper around user controller.
- ✏️ `src/schemas/auth.schema.ts`, `src/schemas/user.schema.ts`, `src/schemas/profile.schema.ts` — Zod shapes mirror the new flat user.

### Coach

- ✏️ `src/controllers/coach.controller.ts` — drop CoachSettings include; settings are now on `coach` directly. Add `include: { user: true }` everywhere identity is needed.
- 🗑️ `src/controllers/coach-settings.controller.ts` — delete.
- 🗑️ `src/schemas/coach-settings.schema.ts` — delete.
- ✏️ `src/schemas/coach.schema.ts` — Zod shape gains `max_clients`, `accepting_clients`, `is_discoverable`; drops `name`, `email`, etc. (now on user payload).
- ✏️ `src/controllers/class.controller.ts` — `SubscribedCoach` → `subscribed_coach`, identity through joined user.
- ✏️ `src/schemas/class.schema.ts` — same renames.

### Programs / routines / exercises (template library)

- ✏️ `src/controllers/program.controller.ts` — drop dual ownership; assignment now creates the snapshot tree (see B9). Drop `ProgramRoutine` references entirely.
- ✏️ `src/schemas/program.schema.ts` — assignment payload schema must accept the full prescription tree.
- ✏️ `src/controllers/standalone.controller.ts` — same. See B11 about ad-hoc workouts.
- ✏️ `src/schemas/standalone.schema.ts` — same.
- ✏️ `src/controllers/workout.controller.ts` — drop `RoutineExercise` template reads; reads come from `assigned_program_routine_exercise`. `WorkoutSession.userId` no longer exists (B11).
- ✏️ `src/schemas/workout.schema.ts` — drop fields no longer in `exercise` (`primaryMuscleGroup`, `equipmentNeeded`).

### Sessions / stats

- ✏️ `src/controllers/sessions.controller.ts` — listing by user goes through the relational path (B11).
- ✏️ `src/schemas/sessions.schema.ts` — drop `notes` → `feedback` rename, drop `setNumber`/`rpe`/`weightKg` → `set_number`/`weight`.
- ✏️ `src/controllers/stats.controller.ts` — same; aggregations rewritten.
- ✏️ `src/schemas/stats.schema.ts` — same.

### Pose

- ✏️ `src/controllers/pose.controller.ts` — see B7. Form upload becomes S3-key based; `FormComparisonResult` endpoints removed; pose config reads come from `exercise.active_segments`.
- ✏️ `src/schemas/pose.schema.ts` — drop landmark JSON fields, drop pose-config fields, accept `recorded_frames_key`.

### Subscription / payment

- ✏️ `src/controllers/subscription.controller.ts` — `Plan` → `subscription_plan` + `provider_plan`. Drop promo branches. Drop `receiptData`. Read tier/features through `subscription_plan` join.
- ✏️ `src/services/subscription.service.ts` — see B3, B4, B5. Heaviest service rewrite in the codebase.
- ✏️ `src/middleware/subscription.middleware.ts` — see B1.
- ✏️ `src/middleware/auth.middleware.ts` — see B1.
- ✏️ `src/schemas/subscription.schema.ts` — payload shapes for new fields, new enums.
- ✏️ `src/providers/payment/index.ts` (and provider-specific submodules) — webhook handler now writes through `webhook_event` first, then dispatches.
- ✏️ `server/scripts/sync-plans.ts` — see B14.

### Promo (delete)

- 🗑️ `src/controllers/promo.controller.ts`
- 🗑️ `src/services/promo.service.ts`
- 🗑️ `src/schemas/promo.schema.ts`
- 🗑️ `src/routes/promo.routes.ts` (if it exists as a separate route file)
- ✏️ Wherever promo routes are mounted in `src/index.ts` or `src/app.ts` — remove the mount.

### Coins / cosmetics

- ✏️ `src/services/coin-calculation.service.ts` — see B2 + B13. Atomic balance update with `FOR UPDATE`. Replace `EconomyConfig` reads with constants.
- ✏️ `src/utils/streak.ts` — same balance-update pattern.
- ✏️ `src/controllers/coins.controller.ts` — read `coin_balance` from `user` directly; transactions list from `coin_transactions`.
- ✏️ `src/controllers/cosmetics.controller.ts` — see B8. Composite-key `where` clauses; equip/unequip transaction.
- ✏️ `src/controllers/shop.controller.ts` — purchase flow uses the atomic balance pattern from B2; `Cosmetic` → `cosmetics`; `coinCost` → `price`; `unityAssetRef` reference dropped (or replaced — confirm with product).
- ✏️ `src/schemas/coins.schema.ts`, `src/schemas/cosmetics.schema.ts`, `src/schemas/shop.schema.ts` — field renames.
- ➕ `src/config/economy.ts` — new constants file replacing `EconomyConfig`.

### Leaderboard

- ✏️ `src/services/leaderboard.service.ts` — heavy aggregation across many models. Renames + B11 (workout_session→user path) + drop `FormComparisonResult` aggregations. Likely the second-heaviest service rewrite after `subscription.service.ts`.
- ✏️ `src/controllers/leaderboard.controller.ts` — minimal renames.
- ✏️ `src/schemas/leaderboard.schema.ts` — same.

### Missions / partners (new feature surface)

- ➕ `src/controllers/missions.controller.ts` (or similar) — list missions, get progress, claim rewards.
- ➕ `src/services/missions.service.ts` — progress increment logic per `goal_type`, raffle entry creation on completion.
- ➕ `src/schemas/missions.schema.ts` — Zod shapes.
- ➕ `src/controllers/partners.controller.ts` (admin) — CRUD for partners and missions.
- ➕ `src/routes/missions.routes.ts` — route mounting.
- ➕ Hooks into `coin-calculation.service.ts` and workout-completion path so `goal_type = COMPLETE_WORKOUTS` and `EARN_COINS` missions auto-progress.

### Glue

- ✏️ `src/config/database.ts` — should not need changes; the singleton import stays the same. The Prisma client model accessors change from `prisma.user`, `prisma.userProfile` → `prisma.user`, `prisma.coach`, `prisma.subscription_plan`, etc.

---

## Section D — Suggested Phase 2 Work Order

Work bottom-up from types/middleware to controllers, so each layer has a stable base before its consumer is touched.

1. **Types & middleware** — unblocks the entire app for compile.
   - `src/types/express.d.ts`
   - `src/middleware/auth.middleware.ts`
   - `src/middleware/subscription.middleware.ts`
2. **Delete the promo system entirely.** Removes a whole tree of compile errors with one commit.
3. **Service layer** — order matters because controllers depend on these.
   - `src/services/subscription.service.ts` (largest rewrite — B3, B4, B5)
   - `src/services/coin-calculation.service.ts` (B2, B13)
   - `src/services/leaderboard.service.ts` (renames + B11)
   - `src/utils/streak.ts`
   - ➕ `src/config/economy.ts`
4. **Controllers**, in dependency order:
   1. `auth.controller.ts`, `user.controller.ts`, `profile.controller.ts` (foundational)
   2. `coach.controller.ts`, `class.controller.ts` (delete `coach-settings.controller.ts`)
   3. `program.controller.ts`, `standalone.controller.ts` (snapshot assignment — B9)
   4. `workout.controller.ts`, `sessions.controller.ts`, `stats.controller.ts` (B11)
   5. `pose.controller.ts` (B7 — S3 form upload)
   6. `coins.controller.ts`, `cosmetics.controller.ts`, `shop.controller.ts` (B2, B8)
   7. `subscription.controller.ts`
   8. `leaderboard.controller.ts`
5. **Zod schemas** updated alongside their controllers (don't try to do all schemas first or you'll lose the link to controller intent).
6. **`server/scripts/sync-plans.ts`** (B14).
7. **Missions / partners** (new surface) — last, since it's additive and doesn't block existing code.
8. **Apply the migration**: once `pnpm build` and `pnpm lint` pass, run `pnpm prisma migrate reset --force && pnpm prisma migrate dev --name schema_redesign` to actually apply the schema to the dev DB.

---

## Section E — Verification Checklist

After Phase 2:

- [ ] `pnpm prisma validate` — schema parses.
- [ ] `pnpm prisma migrate reset --force && pnpm prisma migrate dev --name schema_redesign` — clean migration apply against a reset dev DB.
- [ ] `pnpm prisma generate` — client regenerates without errors.
- [ ] `pnpm build` — TypeScript compiles.
- [ ] `pnpm lint` — no lint errors.
- [ ] `node --test` — existing tests pass (some will need updating).
- [ ] **Manual smoke tests**:
  - [ ] Sign up + sign in (auth flow, `user` row created with all profile fields).
  - [ ] Coach upgrade (`is_coach = true`, `coach` row created).
  - [ ] Subscribe to a plan (Google Play sandbox webhook → `webhook_event` → `subscription` + `subscription_plan_history` + `payment_history` rows; `subscription_event` linked).
  - [ ] Idempotency: re-deliver the same webhook → no duplicate rows.
  - [ ] Auth middleware hot path: `EXPLAIN ANALYZE` shows index-only scan on `(user_id, status, current_period_end)`.
  - [ ] Create a program → assign to a user with the full snapshot tree → list assigned program → list workouts.
  - [ ] Complete a workout: `coin_balance` increments, `coin_transactions` row inserted with correct `balance_after`, breakdown columns populated.
  - [ ] Concurrent coin earns: spawn two simultaneous workout-complete requests, confirm `balance_after` is consistent and equals `user.coin_balance`.
  - [ ] Coach uploads an `exercise_form`: pre-signed S3 URL flow, `recorded_frames_key` populated, no JSON in DB.
  - [ ] Equip cosmetic: only one equipped per category at a time.
  - [ ] Mission progress: complete a workout and see `user_mission.progress` increment.
  - [ ] Refund flow: webhook → `payment_history.status = 'REFUNDED'`, `subscription_event` row written.
- [ ] **Reconciliation job**: a one-shot script that runs the rationale's coin-balance reconciliation query and reports any drift (should be zero):
  ```sql
  SELECT u.supabase_auth_id, u.coin_balance, COALESCE(SUM(ct.value), 0) AS computed
  FROM "user" u
  LEFT JOIN coin_transactions ct ON ct.user_id = u.supabase_auth_id
  GROUP BY u.supabase_auth_id, u.coin_balance
  HAVING u.coin_balance != COALESCE(SUM(ct.value), 0);
  ```
