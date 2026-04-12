# Schema Migration — Task Tracker

> Generated from `schema-migration-dependency-map.md`. Mark tasks `[x]` as each is completed.
> Reference: behavioral changes B1–B14 are defined in the dependency map.

---

## Phase 1: Copy Plan

- [x] Create this task-tracking document

---

## Phase 2: Foundation — Types, Middleware & Deletions

**Goal:** Get the type layer and middleware compiling. Delete dead code.

### Types & Middleware
- [x] `src/types/express.d.ts` — type declaration lives in `auth.middleware.ts`; no changes needed here
- [x] `src/middleware/auth.middleware.ts` — `user`/`coach` Prisma types, `supabase_auth_id` PK, subscription query via composite index, inlined user lookup (removed `getUserBySupabaseId` dependency)
- [x] `src/middleware/subscription.middleware.ts` — `supabase_auth_id` lookup, composite-index query `(user_id, status, current_period_end)`, `subscription_plan` join

### Delete Promo System (B6)
- [x] Delete `src/controllers/promo.controller.ts`
- [x] Delete `src/services/promo.service.ts`
- [x] Delete `src/schemas/promo.schema.ts`
- [x] Delete `src/routes/promo.routes.ts`
- [x] Remove promo route mount from `src/index.ts`

### Delete Coach Settings (merged into coach)
- [x] Delete `src/controllers/coach-settings.controller.ts`
- [x] Delete `src/schemas/coach-settings.schema.ts`
- [x] Delete `src/routes/coach-settings.routes.ts`
- [x] Remove coach-settings route mount from `src/index.ts` — was never mounted; confirmed clean

### Cleanup
- [x] Audit `subscription.service.ts` / `subscription.controller.ts` for promo references — none found; no changes needed

---

## Phase 3: Service Layer

**Goal:** Rewrite all services so controllers have a stable API.

### Subscription Service (B3, B4, B5)
- [x] `src/services/subscription.service.ts` — idempotency via `webhook_event.idempotency_key`
- [x] Implement webhook processing flow: compute idempotency_key → findUnique → insert PENDING → process → update COMPLETED/FAILED
- [x] Every `subscription.status` mutation writes `subscription_event` with `webhook_event_id`, `from_status`, `to_status`
- [x] Plan change SCD2: close previous `subscription_plan_history` row, insert new one with `change_reason`
- [x] Payment idempotency: composite key `(subscription_id, provider_order_id)`, drop `receiptData` writes

### Coin Calculation Service (B2, B13)
- [x] `src/services/coin-calculation.service.ts` — atomic `SELECT ... FOR UPDATE` + balance update in `$transaction`
- [x] `balance_after` computed inside transaction
- [x] Application-level reject overspending (coin_balance >= 0 check)
- [x] Replace all `EconomyConfig` reads with constant lookups

### Economy Config (B13)
- [x] Create `src/config/economy.ts` — enumerate existing EconomyConfig keys, export typed constants

### Leaderboard Service
- [x] `src/services/leaderboard.service.ts` — model renames + workout_session→user relational path (B11), drop FormComparisonResult aggregations

### Streak Utility
- [x] `src/utils/streak.ts` — atomic balance pattern for any coin writes

### Payment Provider
- [x] `src/providers/payment/google-play.provider.ts` — webhook writes through `webhook_event` first, then dispatches
- [x] `src/providers/payment/index.ts` — provider dispatch updates
- [x] `src/providers/payment/payment.provider.interface.ts` — interface updates for new fields

---

## Phase 4: Controllers — Identity, Coach & Programs

**Goal:** Fix auth/user/profile/coach controllers.

### Auth & User (B12)
- [ ] `src/controllers/auth.controller.ts` — drop UserProfile creation, create flat `user` row
- [ ] `src/schemas/auth.schema.ts` — Zod shapes mirror flat user
- [ ] `src/routes/auth.routes.ts` — update if middleware refs changed
- [ ] `src/controllers/user.controller.ts` — flatten profile operations
- [ ] `src/schemas/user.schema.ts` — flat user shape

### Profile
- [ ] `src/controllers/profile.controller.ts` — flatten reads/writes onto `user` model
- [ ] `src/schemas/profile.schema.ts` — flat shape

### Coach (B10)
- [ ] `src/controllers/coach.controller.ts` — drop CoachSettings include (settings now on `coach`), add `include: { user: true }` for identity
- [ ] `src/schemas/coach.schema.ts` — gains `max_clients`, `accepting_clients`, `is_discoverable`; drops `name`, `email` (on user)
- [ ] `src/controllers/class.controller.ts` — `SubscribedCoach`→`subscribed_coach`, identity through joined user
- [ ] `src/schemas/class.schema.ts` — renames

---

## Phase 5: Controllers — Programs & Standalone

**Goal:** Fix program templates and assignment flow.

### Program Assignment (B9)
- [ ] `src/controllers/program.controller.ts` — snapshot assignment: create `assigned_program` + `assigned_program_routine` + `assigned_program_routine_exercise` in single transaction
- [ ] `src/schemas/program.schema.ts` — full prescription tree payload schema
- [ ] `src/routes/program.routes.ts` — route updates

### Standalone (B9 + B11)
- [ ] `src/controllers/standalone.controller.ts` — snapshot pattern, every workout must belong to an assigned_program_routine
- [ ] `src/schemas/standalone.schema.ts` — schema updates
- [ ] `src/routes/standalone.routes.ts` — route updates
- [ ] `src/routes/routine.routes.ts` — likely delete or restructure (template-level junctions removed)

---

## Phase 6: Controllers — Workouts, Sessions & Stats

**Goal:** Fix workout execution pipeline and stats aggregations.

### Workouts (B11)
- [ ] `src/controllers/workout.controller.ts` — drop `RoutineExercise` template reads, reads from `assigned_program_routine_exercise`; `WorkoutSession.userId` gone
- [ ] `src/schemas/workout.schema.ts` — drop `primaryMuscleGroup`, `equipmentNeeded` fields
- [ ] `src/routes/workout.routes.ts` — route updates

### Sessions & Stats (B11)
- [ ] `src/controllers/sessions.controller.ts` — listing by user via relational path through assigned_program_routine → assigned_program
- [ ] `src/schemas/sessions.schema.ts` — `notes`→`feedback`, `setNumber`→`set_number`, drop `rpe`/`weightKg`→`weight`
- [ ] `src/routes/sessions.routes.ts`
- [ ] `src/controllers/stats.controller.ts` — aggregations rewritten for relational path
- [ ] `src/schemas/stats.schema.ts`
- [ ] `src/routes/stats.routes.ts`

---

## Phase 7: Controllers — Pose, Coins, Cosmetics, Subscription & Leaderboard

**Goal:** Complete remaining controllers.

### Pose (B7)
- [ ] `src/controllers/pose.controller.ts` — S3-key based form upload, delete FormComparisonResult endpoints, active_segments from `exercise.active_segments`
- [ ] `src/schemas/pose.schema.ts` — drop landmark JSON fields, accept `recorded_frames_key`
- [ ] `src/routes/pose.routes.ts`

### Coins & Cosmetics (B2, B8)
- [ ] `src/controllers/coins.controller.ts` — read `coin_balance` from `user` directly; list from `coin_transactions`
- [ ] `src/schemas/coins.schema.ts`
- [ ] `src/controllers/cosmetics.controller.ts` — composite PK `(user_id, cosmetic_id)`, equip/unequip via `equipped_at`, one-per-category in application code
- [ ] `src/schemas/cosmetics.schema.ts`
- [ ] `src/controllers/shop.controller.ts` — atomic balance pattern, `Cosmetic`→`cosmetics`, `coinCost`→`price`
- [ ] `src/schemas/shop.schema.ts`

### Subscription & Webhook
- [ ] `src/controllers/subscription.controller.ts` — `Plan`→`subscription_plan` + `provider_plan`, drop promo branches, drop `receiptData`
- [ ] `src/schemas/subscription.schema.ts`
- [ ] `src/controllers/webhook.controller.ts` — dispatch through new webhook_event flow

### Leaderboard
- [ ] `src/controllers/leaderboard.controller.ts` — minimal renames
- [ ] `src/schemas/leaderboard.schema.ts`

### Routes for all above
- [ ] `src/routes/coins.routes.ts`
- [ ] `src/routes/cosmetics.routes.ts`
- [ ] `src/routes/shop.routes.ts`
- [ ] `src/routes/subscription.routes.ts`
- [ ] `src/routes/webhook.routes.ts`
- [ ] `src/routes/leaderboard.routes.ts`

---

## Phase 8: Scripts, Missions & Verification

**Goal:** Sync-plans script, missions/partners (new feature), final verification.

### Sync Plans Script (B14)
- [ ] `server/scripts/sync-plans.ts` — write to `subscription_plan` (catalog) + `provider_plan` (Google Play satellite)
- [ ] Matching logic: upsert `subscription_plan` by name, upsert `provider_plan` by composite `(provider, provider_product_id)`

### Missions & Partners (new surface)
- [ ] Create `src/controllers/missions.controller.ts` — list missions, get progress, claim rewards
- [ ] Create `src/services/missions.service.ts` — progress increment per `goal_type`, raffle entry on completion
- [ ] Create `src/schemas/missions.schema.ts`
- [ ] Create `src/routes/missions.routes.ts`
- [ ] Create `src/controllers/partners.controller.ts` (admin CRUD)
- [ ] Hook into `coin-calculation.service.ts` for `EARN_COINS` goal_type auto-progress
- [ ] Hook into workout-completion path for `COMPLETE_WORKOUTS` goal_type auto-progress
- [ ] Mount missions routes in `src/index.ts`

### Verification Checklist
- [ ] `pnpm prisma validate` — schema parses
- [ ] `pnpm prisma generate` — client regenerates
- [ ] `pnpm build` — TypeScript compiles
- [ ] `pnpm lint` — no lint errors
- [ ] `node --test` — tests pass
- [ ] Manual smoke tests (see dependency map Section E)
