# Missing Links — Client-to-Coach Subscription Flow

> **Branch**: `subtask/GG-56-link-coach-programs-to-personal-programs`
> **Last Updated**: February 21, 2026
> **Status**: 🔍 Audit Complete — Pending Implementation

---

## Flow Under Review

```
[1] Client subscribes to platform (Google Play → POST /api/subscriptions/verify)
      ↓
[2] Client fetches coaches (public → GET /api/user/coaches)
      ↓
[3] Client views a coach profile (public → ???)
      ↓
[4] Client subscribes to a coach (requires platform subscription → POST /api/user/coaches/:coachId)
      ↓
[5] Coach sees client on roster (GET /api/coach/class)
```

---

## Missing Links

### ML-1 · No Single Coach Profile Endpoint

**Flow Step**: [3] — Client views a coach profile

| | |
|---|---|
| **Missing** | `GET /api/user/coaches/:coachId` |
| **Current State** | Only `GET /api/user/coaches` (list/search) exists. There is no way to fetch a single coach's full public profile. |
| **Impact** | Clients cannot deep-link to a coach profile or navigate to one from the discovery list. The coach-subscribe UI cannot load the profile data needed before the subscribe action. |
| **Files to Create/Modify** | `src/routes/user.routes.ts`, `src/controllers/user.controller.ts`, `src/schemas/user.schema.ts` |

**What to implement:**
- Add `GET /api/user/coaches/:coachId` — public, no auth required.
- Return the same fields already projected in `discoverCoaches` (`id`, `name`, `email`, `avatarUrl`, `bio`, `yearsExperience`, `certifications`, `awards`, `specialties`, `isVerified`) plus any extra fields useful for a detail view (e.g., `socialLinks`, `createdAt`).
- Return `404` if the coach ID does not exist.

---

### ML-2 · `subscribeToCoach` Has No Platform Subscription Guard

**Flow Step**: [4] — Client subscribes to a coach (requires a subscription)

| | |
|---|---|
| **Missing** | `requireSubscription()` middleware on `POST /api/user/coaches/:coachId` |
| **Current State** | The route chain is `authenticateSupabaseUser → requireAppUser → validateRequest → subscribeToCoach`. `requireSubscription()` is **never applied**. The `subscribeToCoach` controller also performs no `isSubscribed` check on `req.user.subscription`. Any authenticated user — including free-tier — can subscribe to a coach. |
| **Impact** | Core business rule is unenforced. Free users bypass the paywall and join coach rosters without a platform subscription. |
| **Files to Modify** | `src/routes/user.routes.ts` |

**What to implement:**
- Insert `requireSubscription()` (from `subscription.middleware.ts`) into the `POST /coaches/:coachId` route, between `requireAppUser` and `validateRequest`.
- The `requireSubscription` factory already checks `isSubscribed` and enforces `minTier` — use `requireSubscription()` (default `minTier: 1`) for this route.
- No changes to the controller are required since the middleware handles the rejection.

**Proposed route chain:**
```typescript
router.post(
  '/coaches/:coachId',
  authenticateSupabaseUser,
  requireAppUser,
  requireSubscription(),          // ← ADD THIS
  validateRequest(SubscribeCoachSchema),
  subscribeToCoach
);
```

---

### ML-3 · Webhook Does Not Evict Clients From Coach Rosters on Platform Expiry/Revocation

**Flow Step**: Between [4] and [5] — What happens when a client's platform subscription lapses?

| | |
|---|---|
| **Missing** | Side-effect in `processWebhookEvent` to set `SubscribedCoach.endedAt` on terminal subscription events |
| **Current State** | `processWebhookEvent` in `subscription.service.ts` updates the `Subscription` table only. When terminal webhook events arrive the user's `SubscribedCoach` rows are never touched — `endedAt` stays `null`. The user remains on every coach's roster indefinitely. |
| **Impact** | Coaches see clients on their roster who have lost their platform subscription. Expired users retain access to coach-scoped features indefinitely. |
| **Files to Modify** | `src/services/subscription.service.ts` |

#### Grace Period Considerations

Not all non-`ACTIVE` statuses are terminal. The eviction rule must respect the Google Play subscription lifecycle:

| Webhook Event | Our `SubscriptionStatus` | Access? | Evict from roster? |
|---|---|---|---|
| `SUBSCRIPTION_PURCHASED` / `SUBSCRIPTION_RENEWED` | `ACTIVE` | ✅ Yes | No |
| `SUBSCRIPTION_CANCELED` | `CANCELED` | ✅ Yes (until `currentPeriodEnd`) | **No** — user paid through the end of the period |
| `SUBSCRIPTION_ON_HOLD` | `PAST_DUE` | ✅ Yes (grace period) | **No** — payment is retrying, user still has access |
| `SUBSCRIPTION_EXPIRED` | `EXPIRED` | ❌ No | **Yes** — period has ended |
| `SUBSCRIPTION_REVOKED` | `REVOKED` | ❌ No | **Yes** — refund/admin revocation, immediate |

**Rule**: Only evict on `EXPIRED` and `REVOKED`. `CANCELED` means the user chose not to renew but still has paid time remaining; `PAST_DUE` means a grace period is active and Google is retrying the payment.

#### What to Implement

Extract a helper `evictUserFromCoachRosters(userId)` and call it only from the `SUBSCRIPTION_EXPIRED` and `SUBSCRIPTION_REVOKED` webhook branches inside `processWebhookEvent`:

```typescript
/**
 * Bulk-ends all active SubscribedCoach relationships for a user.
 * Call only on terminal events (EXPIRED, REVOKED) — not on CANCELED or PAST_DUE.
 */
const evictUserFromCoachRosters = async (userId: string): Promise<void> => {
  const result = await prisma.subscribedCoach.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  });
  logger.info('Evicted user from coach rosters', {
    userId,
    affectedRosters: result.count,
  });
};

// Inside processWebhookEvent, after updateSubscriptionFromProvider:
if (
  eventData.eventType === 'SUBSCRIPTION_EXPIRED' ||
  eventData.eventType === 'SUBSCRIPTION_REVOKED'
) {
  await evictUserFromCoachRosters(subscription.userId);
}
```

---

### ML-4 · Coach Roster Does Not Surface Client Subscription Expiry

**Flow Step**: [5] — Coach sees client on roster

| | |
|---|---|
| **Missing** | `subscriptionExpiresAt` field in roster responses |
| **Current State** | `GET /api/coach/class` and `GET /api/coach/clients` return `id`, `email`, `name`, `nickname`, `subscribedAt`, `assignedPrograms`. There is no indication of when a client's platform subscription ends. |
| **Impact** | Coaches cannot see when a client's subscription is about to lapse. A coach may invest time in a client who is one day from expiry without any warning. |
| **Files to Modify** | `src/controllers/class.controller.ts`, `src/controllers/coach.controller.ts` |

#### Privacy Boundary

We expose **only the expiry date** — not the subscription status, plan name, tier level, or price. This gives the coach just enough operational signal ("this client expires in 3 days") without leaking personal financial data.

#### What to Implement

- In the `prisma.subscribedCoach.findMany` call, include the user's most recent active subscription's `currentPeriodEnd` only:

```typescript
include: {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      nickname: true,
      // Fetch the single most recent active subscription's period end
      subscriptions: {
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        },
        select: { currentPeriodEnd: true },
        orderBy: { currentPeriodEnd: 'desc' },
        take: 1,
      },
    },
  },
}
```

- Map to the response as:

```typescript
{
  id, email, name, nickname, subscribedAt,
  subscriptionExpiresAt: user.subscriptions[0]?.currentPeriodEnd ?? null, // ← ADD
}
```

`null` means the client has no active subscription (edge case after ML-3 is in place, but defensive).

---

### ML-5 · No Coach Client Capacity Enforcement

**Flow Step**: [4] — Client subscribes to a coach

| | |
|---|---|
| **Missing** | `CoachSettings` model + capacity check in `subscribeToCoach` |
| **Current State** | The `Coach` model has no capacity settings. `subscribeToCoach` only checks for an existing subscription — it never checks how many clients the coach already has. Any number of clients can subscribe to any coach. |
| **Impact** | Coaches can be overwhelmed with clients. There is no business lever for coaches to cap intake. |
| **Files to Modify** | `prisma/schema.prisma`, `src/controllers/user.controller.ts`, new `src/controllers/coach-settings.controller.ts`, new `src/routes/coach-settings.routes.ts`, new `src/schemas/coach-settings.schema.ts` |

#### New Model: `CoachSettings`

Settings are extracted into a dedicated model (1-to-1 with `Coach`) to keep the `Coach` model focused on identity/profile data and give settings room to grow independently.

```prisma
model CoachSettings {
  id      String @id @default(cuid())
  coachId String @unique

  // Client capacity
  maxClients        Int     @default(40)  // Hard cap on active client count
  acceptingClients  Boolean @default(true) // Manual on/off switch for new intake

  // Discovery
  isDiscoverable    Boolean @default(true) // Appear in public coach search results

  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz

  coach Coach @relation(fields: [coachId], references: [id], onDelete: Cascade)
}
```

**MVP Settings Rationale:**

| Field | Default | Purpose |
|---|---|---|
| `maxClients` | `40` | Hard capacity cap. Coach can lower it to close intake early. |
| `acceptingClients` | `true` | Manual kill-switch. Allows a coach to pause intake without changing `maxClients`. |
| `isDiscoverable` | `true` | Controls whether the coach appears in `GET /api/user/coaches`. Useful for coaches who want to onboard by invite only. |

#### Changes to `Coach` Model

Add the relation to `Coach`:
```prisma
model Coach {
  // ... existing fields ...
  settings CoachSettings?
}
```

`CoachSettings` is created automatically (with defaults) when a coach profile is created in `createCoachProfile`.

#### Capacity Check in `subscribeToCoach`

Before creating the `SubscribedCoach` row, check both guards:

```typescript
// Load coach with settings
const coach = await prisma.coach.findUnique({
  where: { id: coachId },
  include: { settings: true },
});

if (!coach) { /* 404 */ }

const settings = coach.settings;

// Guard 1: manual intake toggle
if (settings && !settings.acceptingClients) {
  sendSingleError(res, 'This coach is not accepting new clients at this time', 409);
  return;
}

// Guard 2: capacity cap
if (settings) {
  const activeClientCount = await prisma.subscribedCoach.count({
    where: { coachId, endedAt: null },
  });
  if (activeClientCount >= settings.maxClients) {
    sendSingleError(res, 'This coach has reached their maximum client capacity', 409);
    return;
  }
}
```

#### New Endpoints (Coach Settings CRUD)

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/api/coach/settings` | Get own settings | Coach |
| `PATCH` | `/api/coach/settings` | Update settings (maxClients, acceptingClients, isDiscoverable) | Coach |

The `isDiscoverable` setting must be respected by `discoverCoaches`: add `where: { settings: { isDiscoverable: true } }` (or handle coaches with no settings row as discoverable).

---

## Summary Table

| ID | Flow Step | Missing | Priority |
|----|-----------|---------|----------|
| ML-1 | [3] View coach profile | `GET /api/user/coaches/:coachId` endpoint | 🔴 High |
| ML-2 | [4] Subscribe to coach | `requireSubscription()` middleware on subscribe route | 🔴 High |
| ML-3 | [4]→[5] Subscription lapse | Webhook does not evict clients on `EXPIRED`/`REVOKED`; respects grace period for `CANCELED`/`PAST_DUE` | 🔴 High |
| ML-4 | [5] Coach roster | Roster does not expose `subscriptionExpiresAt` (expiry date only — no status/plan data) | 🟡 Medium |
| ML-5 | [4] Subscribe to coach | No `CoachSettings` model; no `maxClients` (default 40) / `acceptingClients` / `isDiscoverable` enforcement | 🟡 Medium |

---

## Files Affected

| File | Changes Required By |
|------|---------------------|
| `src/routes/user.routes.ts` | ML-1, ML-2 |
| `src/controllers/user.controller.ts` | ML-1, ML-5 |
| `src/schemas/user.schema.ts` | ML-1 |
| `src/services/subscription.service.ts` | ML-3 |
| `src/controllers/class.controller.ts` | ML-4 |
| `src/controllers/coach.controller.ts` | ML-4, ML-5 (createCoachProfile seeds CoachSettings) |
| `prisma/schema.prisma` | ML-5 (new `CoachSettings` model, `Coach.settings` relation) |
| `src/controllers/coach-settings.controller.ts` | ML-5 (new file) |
| `src/routes/coach-settings.routes.ts` | ML-5 (new file, mounted under `/api/coach/settings`) |
| `src/schemas/coach-settings.schema.ts` | ML-5 (new file) |
