# Get Gains -- Schema Design Rationale

This document explains the design decisions behind each domain in the Get Gains database schema. It is written from the perspective of a database engineer designing the schema to satisfy domain requirements first, independent of any particular frontend or backend framework.

---

## 1. Overview

The schema is organized into the following bounded domains:

| Domain | Core Tables | Purpose |
|--------|------------|---------|
| Identity | `user`, `coach` | Who uses the system |
| Training Library | `program`, `routine`, `exercise`, `exercise_form` | Reusable training templates |
| Assignment & Execution | `assigned_program`, `assigned_program_routine`, `assigned_program_routine_exercise`, `workout_session`, `performed_set` | Snapshot-based program instances and workout tracking |
| Pose Detection | `exercise_form` (shared), form comparison results | AI-assisted form analysis |
| Subscription | `subscription_plan`, `provider_plan`, `subscription`, `subscription_plan_history`, `payment_history`, `webhook_event`, `subscription_event` | Billing, access control, financial audit |
| Gamification | `cosmetics`, `user_cosmetic`, `coin_transactions` | Virtual economy and cosmetic rewards |
| Missions & Partners | `partner`, `mission`, `user_mission`, `raffle_entry` | Engagement campaigns and sponsor integrations |

**Key architectural principle:** The schema separates *templates* (what a coach designs) from *instances* (what a user actually does). This enables programs to evolve without rewriting workout history, and coaches to reuse building blocks across clients.

---

## 2. User & Profile Domain

### Tables: `user`

### Design Decisions

**Flattened user model (no separate profile table).** The old schema split user data across `User` and `UserProfile`. The proposed schema merges profile fields (`bio`, `avatar_key`, `height_cm`, `weight_kg`, `sex`, `date_of_birth`, `equipment_available`, `experience_level`, `active_weekdays`) directly into the `user` table. This eliminates a mandatory 1:1 join on every user query.

*Rationale:* A separate profile table is justified when profile data is large, optional, or has a different access pattern than the core identity. In this case, nearly every API endpoint that loads a user also needs profile fields (height/weight for workout context, experience level for recommendations). The join penalty outweighs the organizational benefit.

**Supabase auth ID as primary key.** The `user` table uses `supabase_auth_id` as its PK rather than a synthetic `cuid()`. Since Supabase is the identity provider, every authenticated request already carries this ID. Using it as the PK avoids a lookup-by-unique-column query on every request.

**Denormalized `coin_balance`.** A running balance is stored directly on the user row rather than computed from `coin_transactions` via `SUM()`. This is a deliberate denormalization for read performance -- the balance is checked frequently (shop purchases, leaderboard display) but only modified within explicit transaction boundaries that also write to `coin_transactions`. The transaction log remains the source of truth; the balance is a materialized cache.

**Soft delete via `deleted_at`.** User accounts are soft-deleted rather than hard-deleted. This preserves referential integrity across workout history, payment records, and coach relationships. Hard-deleting a user would cascade-delete financial audit records, which violates compliance requirements.

---

## 3. Coach Domain

### Tables: `coach`, `subscribed_coach`

### Design Decisions

**Coach as a role extension, not a separate entity.** The `coach` table uses `user_id` as both its PK and FK to `user`. A coach *is* a user with additional capabilities. This avoids duplicating identity fields (name, email, avatar) and ensures a single authentication path.

The `is_coach` flag on the `user` table provides a fast boolean check without joining to `coach`. The `coach` row itself holds role-specific data (certifications, specialties, social links).

**Settings folded into coach.** The old schema had a separate `CoachSettings` table for `max_clients`, `accepting_clients`, and `is_discoverable`. These are moved directly into `coach` because:
- They are always loaded together with coach data (discovery searches, client capacity checks).
- There is no independent lifecycle -- settings do not exist without a coach.
- The 1:1 relationship adds join cost for zero normalization benefit.

**Subscribed coach relationship.** `subscribed_coach` is a temporal junction table tracking coach-client relationships. The `started_at` / `ended_at` pair enables SCD Type 2 history -- when a subscription expires and the user is evicted from a coach's roster, `ended_at` is set rather than deleting the row. This preserves the history of who trained with whom.

---

## 4. Program & Routine Domain

### Tables: `program`, `routine`, `exercise`, `exercise_form`

### Design Decisions

**Three-level template hierarchy: Program > Routine > Exercise.** This mirrors how training is actually structured:
- A **program** is a multi-week plan (e.g., "12-Week Hypertrophy").
- A **routine** is a single workout session template (e.g., "Push Day A").
- An **exercise** is an atomic movement (e.g., "Barbell Bench Press").

Each level is independently reusable. A coach can include the same routine in multiple programs, and the same exercise in multiple routines.

**Single ownership model.** In the proposed schema, `program`, `routine`, and `exercise` each have a single `user_id` FK. The old schema had dual ownership (`coachId` + `userId` + `customForUserId` on Program). This was simplified because:
- A coach *is* a user. Coach-created content uses the coach's `user_id`.
- The `customForUserId` concept (a program created by a coach specifically for one client) is handled at the assignment level, not the template level. The template itself remains in the coach's library.
- The `is_public` flag (old schema) controlled visibility. This is now handled by checking ownership: if `user_id` matches the requesting user or their coach, access is granted.

**Exercise form as S3 key reference.** `exercise_form` stores a `recorded_frames_key` pointing to an S3 object rather than inline JSON. The old schema stored `landmarkFrames`, `featureFrames`, and `normalizedFrames` as JSON columns directly in the database. Moving this to object storage:
- Removes multi-MB JSON blobs from the database, keeping row sizes small and backup/restore fast.
- Allows the mobile client to download frames directly via pre-signed S3 URLs without routing through the API server.
- The `camera_angle` remains in the database for query filtering (e.g., "find the SIDE_LEFT form for this exercise").

**`active_segments` merged from pose config.** The old schema had a separate `ExercisePoseConfig` table with `activeSegments`. The proposed schema merges this into `exercise.active_segments` because every exercise that supports form comparison needs this data, and it's always loaded alongside the exercise.

---

## 5. Workout & Performance Domain

### Tables: `assigned_program`, `assigned_program_routine`, `assigned_program_routine_exercise`, `workout_session`, `performed_set`

### Design Decisions

**Snapshot pattern for assigned programs.** When a program is assigned to a user, the full structure is copied into `assigned_program_routine` and `assigned_program_routine_exercise`. This is the critical design choice in this domain.

*Why snapshot instead of referencing the live template?* If a coach edits a routine (adds an exercise, changes rep ranges), those changes should not retroactively alter an in-progress assignment. The snapshot captures the prescription *at the time of assignment*. This is the same pattern used in e-commerce (order line items snapshot product prices at checkout time).

**`assigned_program_routine` uses `days_of_week` instead of `day_number`.** The old schema used `ProgramRoutine.dayNumber` (Day 1, Day 2) on the template, and the proposed schema uses `days_of_week` (VARCHAR[] like `['MONDAY', 'WEDNESDAY']`) on the assignment. This is more practical for scheduling -- users train on specific weekdays, not abstract day numbers.

**`workout_session` links to `assigned_program_routine`.** Each workout session represents one execution of an assigned routine. The FK to `assigned_program_routine_id` (not `assigned_program_id`) captures *which specific routine* was performed, enabling per-routine progress tracking.

**`performed_set` records actual work.** Each set within a workout is an individual row with `reps`, `weight`, `overall_score`, and a `recorded_frames_key` (S3 pointer to the pose data captured during that set). This granularity enables:
- Per-set form scoring.
- Progressive overload tracking (weight/reps over time).
- Coin reward calculation based on set completion and accuracy.

---

## 6. Pose Detection Domain

### Tables: `exercise` (active_segments), `exercise_form`

### Design Decisions

**On-device comparison, server stores results only.** The architectural decision to perform DTW (Dynamic Time Warping) comparison on the mobile device rather than the server has schema implications:
- The server stores *reference forms* (coach recordings) and *comparison results*, but never processes raw video.
- `exercise_form.recorded_frames_key` points to preprocessed landmark data in S3, not video files.
- Comparison results (scores, corrections) are POSTed to the server after on-device computation.

**JSON for landmark data is appropriate here.** Landmark frames are semi-structured (variable number of landmarks per frame, nested coordinates with confidence scores). Normalizing this into relational tables (a `landmark` table with `frame_id`, `landmark_name`, `x`, `y`, `z`, `confidence`) would create millions of rows for a single recording and make retrieval extremely expensive. JSON stored in S3 is the right trade-off: the data is write-once, read-as-blob, never queried by individual field.

**Camera angle as a query dimension.** `exercise_form.camera_angle` is stored as a database column (not buried in JSON) because the app needs to query "find the active SIDE_LEFT form for exercise X". This is a common filtering criterion that benefits from indexing.

---

## 7. Subscription Domain

### Tables: `subscription_plan`, `provider_plan`, `subscription`, `subscription_plan_history`, `payment_history`, `webhook_event`, `subscription_event`

This is the most complex domain and the focus of this redesign. The approach is **provider-agnostic core with provider-specific satellites**.

### Design Decisions

**Provider abstraction via `provider_plan`.** The old schema mixed Google Play-specific fields (`googleSubscriptionId`, `googleBasePlanId`, `productId`) directly into the `Plan` table. The redesign separates this into:
- `subscription_plan` -- the internal product catalog (name, tier, price, features). Provider-agnostic.
- `provider_plan` -- maps provider-specific IDs to internal plans. One row per provider-plan combination.

*Why this matters:* When Apple App Store support is added, new `provider_plan` rows point to the same `subscription_plan`. No duplication of plan metadata, no conditional columns, no provider-specific nulls polluting the catalog table.

**Billing cycle tracking on `subscription`.** The fields `current_period_start`, `current_period_end`, and `next_billing_date` are retained from the old schema because they are critical for:
1. **Access control** -- the auth middleware runs `WHERE status = 'ACTIVE' AND current_period_end > now()` on every authenticated request. This is the hot path.
2. **Grace periods** -- a subscription can be `PAST_DUE` but still within `current_period_end`, allowing temporary continued access.
3. **Client display** -- the mobile app shows "Your subscription renews on [date]".

**Composite index `(user_id, status, current_period_end)`** is the single most important index in the schema. It covers the auth middleware query as an index-only scan.

**`purchase_token` as a first-class column.** Google Play webhooks identify subscriptions by `purchaseToken`. This field must be a database column (not buried in a JSON `provider_metadata` blob) because it is a query target for webhook correlation. JSON fields cannot be efficiently B-tree indexed for equality lookups in PostgreSQL.

**Idempotency via `webhook_event.idempotency_key`.** Google Pub/Sub retries message delivery on timeout. Without idempotency, the same webhook is processed multiple times, creating duplicate `subscription_event` and `payment_history` records. The `idempotency_key` (set to the Pub/Sub `messageId`) enables a check-before-process pattern:
```
IF EXISTS (SELECT 1 FROM webhook_event WHERE idempotency_key = ? AND status = 'COMPLETED')
  THEN skip processing
```

**`processed_at` is nullable.** The old schema set `processedAt` to `now()` at row creation (before processing started). This made the timestamp meaningless. The redesign sets it to `NULL` on creation and updates it to the actual completion time when `status` transitions to `COMPLETED`.

**SCD Type 2 via `subscription_plan_history`.** When a user upgrades from Basic to Premium, the old schema overwrote `planId` on the subscription row, losing history. The `subscription_plan_history` table records every plan change with `effective_from` / `effective_until` temporal boundaries. The current plan has `effective_until = NULL`.

The `subscription.subscription_plan_id` FK still holds the *current* plan for fast reads (the auth middleware needs `tier_level` on every request and should not join through a temporal table). The history table is the audit dimension.

**Discount tracking after PromoCode removal.** Promo codes, coupons, and discounts are managed by the payment providers (Google Play offers, Apple promotional offers). The server does not need to validate or calculate discounts. However, for analytics and customer support, we track whether a subscription was discounted via two lightweight fields:
- `is_discounted` (boolean) -- was any provider discount applied?
- `discount_description` (text) -- human-readable description (e.g., "50% off first 3 months")

This replaces the old `PromoCode` + `PromoRedemption` tables.

**`subscription_event` retains state transitions.** The proposed draft simplified `subscription_event` to just `notification_id`, `event_type`, and `raw_payload`. The redesign retains `from_status`, `to_status`, `triggered_by`, `reason`, and adds `webhook_event_id`. These fields enable:
- Auditing: "What state was the subscription in before the webhook changed it?"
- Debugging: "Which webhook caused this state change?"
- Compliance: "Who triggered this cancellation -- the user, the system, or a webhook?"

**`payment_history` idempotency fix.** The old schema had `orderId @unique` on both `Subscription` and `PaymentHistory`. Google Play reuses order IDs with renewal suffixes (e.g., `GPA.1234..0`, `GPA.1234..1`). The redesign uses a composite unique `(subscription_id, provider_order_id)` instead, preventing duplicate payments per subscription while allowing the same order ID pattern across different subscriptions.

**Removed `receiptData` from `payment_history`.** Raw receipt data belongs in the `webhook_event.raw_payload` (it's already there as part of the full webhook body). Duplicating it in `payment_history` wastes storage and creates a stale-data risk.

---

## 8. Gamification Domain

### Tables: `cosmetics`, `user_cosmetic`, `coin_transactions`

### Design Decisions

**Separate coin balance vs. transaction log.** The proposed schema denormalizes `coin_balance` directly onto the `user` table. The `coin_transactions` table is the append-only ledger recording every earn/spend event with full breakdown.

*Why denormalize?* Computing balance from `SUM(value) WHERE user_id = ?` over a growing transaction table degrades over time. The balance is read on every shop interaction and leaderboard render. The denormalized balance is updated atomically within the same database transaction that inserts the `coin_transaction` row, maintaining consistency.

**`user_cosmetic` as a composite-PK junction.** The `(user_id, cosmetic_id)` composite PK enforces that a user can own each cosmetic at most once. No surrogate key is needed because:
- The pair is naturally unique.
- There is no child table that would need to FK to a single-column PK.

**`equipped_at` on `user_cosmetic` for equip state.** Rather than a separate `equipped_cosmetic` table, the proposed schema uses `equipped_at` directly on `user_cosmetic`. When non-null, the cosmetic is equipped. This simplifies the model but note: the old schema enforced "one equipped per category" via a `@@unique([userId, category])` on a separate `EquippedCosmetic` table. The proposed design would need application-level enforcement for this constraint, or a partial unique index.

---

## 9. Missions & Partners Domain

### Tables: `partner`, `mission`, `user_mission`, `raffle_entry`

### Design Decisions

**Partner as an optional FK on mission.** Missions can be partner-sponsored (with branding, logos) or platform-native. The nullable `partner_id` FK handles both cases without a type discriminator.

**Goal-based mission tracking.** Each mission has a `goal_type` (e.g., "COMPLETE_WORKOUTS", "EARN_COINS") and `goal_to_reach` (numeric target). `user_mission.progress` tracks the user's current count. This is a simple counter pattern suitable for goals that can be expressed as "do X things N times".

**Raffle as a mission reward type.** `raffle_entry` links to `user_mission` rather than directly to `mission`. This means a raffle entry is only created when a user completes (or qualifies for) a mission. The `is_winner` flag is set when the raffle is drawn.

**Time-bounded missions.** `mission.starts_at` / `ends_at` enable time-limited campaigns. Combined with `max_winners` and `is_repeatable`, this supports seasonal events, partner promotions, and limited-time challenges.

---

## 10. Cross-Cutting Concerns

### Soft Delete Strategy

Tables use `deleted_at TIMESTAMPTZ NULL` where soft delete is needed. The convention:
- `NULL` = active record
- Non-null timestamp = soft-deleted, with the deletion time recorded

**Where soft delete is applied:**
- `user` -- compliance and referential integrity (payment history, workout records)
- `program`, `routine`, `exercise` -- coaches may delete templates, but assigned snapshots must remain valid
- `assigned_program_routine`, `assigned_program_routine_exercise` -- mid-program modifications
- `workout_session`, `performed_set` -- user may want to discard a session
- `cosmetics` -- retire items from the shop without breaking owned inventory

**Where soft delete is NOT applied:**
- `subscription`, `payment_history`, `webhook_event`, `subscription_event` -- financial and audit records are never deleted
- `partner`, `mission` -- use `is_active` or temporal bounds instead
- `provider_plan` -- uses `is_active` flag

### Timestamp Conventions

All temporal columns use `TIMESTAMPTZ` (timestamp with time zone). This ensures:
- Correct ordering across time zones.
- No ambiguity when the server and database are in different zones.
- Proper comparison with `now()` in queries like the auth middleware hot path.

Every table includes `created_at` (defaulting to `now()`). Mutable tables also include `updated_at` (auto-updated by the ORM). Immutable event/log tables (`subscription_event`, `coin_transactions`) only have `created_at`.

### Indexing Strategy

Indexes are designed for specific query patterns, not speculative coverage:

| Pattern | Index | Query |
|---------|-------|-------|
| Auth hot path | `subscription(user_id, status, current_period_end)` | Every authenticated request |
| Webhook correlation | `webhook_event(idempotency_key)` unique | Duplicate detection |
| Webhook to subscription | `subscription(purchase_token)` | Google Play webhooks |
| Plan lookup | `provider_plan(provider, provider_product_id)` unique | Purchase verification |
| Plan fallback | `provider_plan(provider, provider_subscription_id)` | Fallback when composite ID unavailable |
| Payment idempotency | `payment_history(subscription_id, provider_order_id)` unique | Prevent duplicate payment records |
| Retry queue | `webhook_event(status, created_at)` | Find failed webhooks for reprocessing |
| Event timeline | `subscription_event(subscription_id, created_at)` | Subscription audit trail |

Indexes are not added to small lookup tables (`subscription_plan`, `partner`, `cosmetics`) where sequential scans are faster than index lookups.

### Enum Usage

Domain-constrained values use database-level enums or CHECK constraints (mapped to Prisma enums in the ORM layer):

- **Stable, small sets** use enums: `SubscriptionStatus`, `PaymentProvider`, `BillingCycle`, `CameraAngle`, `BodySegment`
- **Extensible sets** use VARCHAR with application-level validation: `event_type` on `webhook_event` (raw provider strings), `goal_type` on `mission` (new goal types added without migration)

### Referential Integrity Rules

| Rule | Used When | Example |
|------|-----------|---------|
| `CASCADE` | Child has no meaning without parent | `subscription_event` when subscription is deleted |
| `SET NULL` | Child can exist independently | `workout_session.assigned_program_id` when program unassigned |
| `RESTRICT` | Deletion should be prevented | `user_cosmetic` → `cosmetics` (can't delete a cosmetic someone owns) |

**Financial tables never cascade-delete.** `payment_history`, `webhook_event`, and `subscription_event` must survive even if the parent subscription is somehow removed. In practice, subscriptions are never hard-deleted.

### ID Generation

All primary keys use `cuid()` (collision-resistant unique identifiers) except:
- `user.supabase_auth_id` -- uses the external identity provider's ID directly
- `coach.user_id` -- shares the user's PK (identifying relationship)

CUIDs are preferred over UUIDs for:
- Lexicographic sortability (roughly time-ordered, beneficial for B-tree index locality)
- Shorter string representation
- No dependency on database-level UUID generation
