# Google Play Subscription Implementation Plan

> **Purpose**: Focused implementation plan for correcting and completing the fullstack Google Play subscription flow.

---

## Current State Summary

### What Exists ✅

**Server (Express):**
- Google Play API integration with `googleapis`
- Purchase verification endpoint (`POST /api/subscriptions/verify`)
- Webhook endpoint for Google Play Pub/Sub (`POST /api/webhooks/google-play`)
- Prisma models: `Plan`, `Subscription`, `PaymentHistory`, `WebhookEvent`, `SubscriptionEvent`
- Provider pattern with `GooglePlayProvider`
- Plan sync script (`scripts/sync-plans.ts`)

**Flutter App:**
- `in_app_purchase` integration with `InAppPurchaseService`
- `SubscriptionRepository` for API calls
- Riverpod providers for state management
- UI widgets: `PlanCard`, `SubscriptionStatusCard`, `UpgradePrompt`, `ProfileSheet`
- Product ID mapping logic (handles `product:basePlan` format)

---

## Critical Issue: Product ID Format Mismatch

### The Problem

The current database has a productId in this format:
```
get_gains.premium:premium-subscription
```

This format is: `{subscriptionId}:{basePlanId}`

**However**, Google Play's Billing Library sends different values at different stages:

| Source | What It Sends | Example |
|--------|---------------|---------|
| `ProductDetails.productId` | Subscription ID only | `get_gains.premium` |
| `PurchaseDetails.productID` | Subscription ID only | `get_gains.premium` |
| Google Play Developer API | Both (in subscription object) | `subscriptionId: "get_gains.premium"`, `basePlanId: "premium-subscription"` |

### Current Matching Logic (Server)

In `subscription.service.ts`:
```typescript
// First try exact match with full productId:basePlanId
let plan = await prisma.plan.findFirst({
  where: { productId: normalizedProductId, provider, isActive: true }
});

// Fallback: try matching by subscription ID only
if (!plan) {
  const subscriptionIdOnly = normalizedProductId.split(':')[0];
  plan = await prisma.plan.findFirst({
    where: { productId: { startsWith: subscriptionIdOnly }, provider, isActive: true }
  });
}
```

### Current Flutter Logic

In `in_app_purchase_service.dart`:
```dart
// Extracts store ID from full ID
// e.g., "get_gains.premium:premium-subscription" -> "get_gains.premium"
final storeId = _extractStoreProductId(fullId);
```

### Why This Could Break

1. **Client sends**: `get_gains.premium` (from `purchase.productID`)
2. **Server tries exact match**: `get_gains.premium` !== `get_gains.premium:premium-subscription` ❌
3. **Server fallback**: Uses `startsWith` which should work ✅

**Risk**: The fallback uses `startsWith` which could match wrong plans if IDs share prefixes.

---

## Implementation Tasks

### Phase 1: Verify & Fix Product ID Handling (Server)

**Priority: HIGH** - This is the foundation for all subscription logic.

#### Task 1.1: Audit Google Play Provider Response

**File**: `src/providers/payment/google-play.provider.ts`

**Current Issue** (Lines 428-433):
```typescript
// Construct combined product ID for plan matching
const productId = subscriptionData.subscriptionId && subscriptionData.basePlanId
  ? `${subscriptionData.subscriptionId}:${subscriptionData.basePlanId}`
  : subscriptionData.subscriptionId || 'unknown';
```

**Action**: Verify this correctly builds the combined ID from the API response.

#### Task 1.2: Improve Plan Matching Logic

**File**: `src/services/subscription.service.ts`

**Problem**: The fallback `startsWith` is fragile.

**Solution**: Use exact match on subscriptionId field (add separate field) OR ensure composite ID is always used.

**Recommended Approach**:

```prisma
// schema.prisma - Add separate fields for clarity
model Plan {
  // ... existing fields
  productId        String @unique  // Full composite: "subscription_id:base_plan_id"
  subscriptionId   String          // Just the subscription ID for matching
  basePlanId       String          // Just the base plan ID
  
  @@index([subscriptionId])
}
```

**Why**: This allows:
- Exact match on `subscriptionId` when client sends just that
- Full composite for display/sync purposes
- No ambiguous `startsWith` matching

#### Task 1.3: Update Sync Script

**File**: `scripts/sync-plans.ts` and `subscription.service.ts`

When syncing from Google Play, populate both fields:
```typescript
{
  productId: `${subscription.productId}:${basePlan.basePlanId}`,
  subscriptionId: subscription.productId,
  basePlanId: basePlan.basePlanId,
}
```

---

### Phase 2: Verify Purchase Flow (End-to-End)

#### Task 2.1: Document Client → Server Purchase Token Flow

**Flutter sends**:
```json
{
  "productId": "get_gains.premium",           // From purchase.productID
  "purchaseToken": "...",                     // From purchase.purchaseToken
  "orderId": "GPA.xxxx"                       // Optional, for reference
}
```

**Server should**:
1. Receive `productId` (subscription ID only)
2. Call Google Play API with `productId` + `purchaseToken`
3. API returns full subscription data with `subscriptionId` + `basePlanId`
4. Match plan using `subscriptionId` field (not composite)
5. Acknowledge purchase
6. Create/update subscription record

#### Task 2.2: Fix Verify Endpoint Parameter Handling

**File**: `src/controllers/subscription.controller.ts`

Ensure the endpoint correctly extracts the subscription ID from what the client sends:

```typescript
// Client may send "get_gains.premium" or "get_gains.premium:premium-subscription"
// Always extract just the subscriptionId for API call
const subscriptionId = productId.split(':')[0];
```

#### Task 2.3: Verify Acknowledgment Uses Correct IDs

**File**: `src/providers/payment/google-play.provider.ts`

The acknowledgment API needs the subscription ID and token, NOT the composite ID:

```typescript
async acknowledgePurchase(productId: string, purchaseToken: string): Promise<boolean> {
  const subscriptionId = productId.split(':')[0]; // Extract subscription ID
  await this.androidPublisher.purchases.subscriptionsv2.acknowledge({
    packageName,
    token: purchaseToken,
    // Note: subscriptionsv2 uses token-based lookup, not product ID
  });
}
```

---

### Phase 3: Webhook Handling Verification

#### Task 3.1: Verify Webhook Notification Parsing

**File**: `src/providers/payment/google-play.provider.ts`

The notification contains:
```json
{
  "subscriptionNotification": {
    "version": "1.0",
    "notificationType": 4,
    "purchaseToken": "...",
    "subscriptionId": "get_gains.premium"  // Just subscription ID, no basePlan
  }
}
```

**Action**: Ensure `parseWebhookEvent` correctly handles this format.

#### Task 3.2: Webhook → Subscription Lookup

When a webhook arrives:
1. Extract `purchaseToken` from notification
2. Look up subscription by `purchaseToken` (unique field)
3. OR call Google Play API to get full details, then match by `subscriptionId`

**Current Code Check**: Verify `handleWebhookNotification` in `subscription.service.ts` handles both cases.

---

### Phase 4: Flutter App Verification

#### Task 4.1: Verify Purchase Details Extraction

**File**: `lib/features/subscription/services/in_app_purchase_service.dart`

Verify `_handlePurchaseUpdates` correctly extracts:
```dart
final purchaseToken = (purchaseDetails as GooglePlayPurchaseDetails)
    .billingClientPurchase
    .purchaseToken;
```

#### Task 4.2: Verify API Call Payload

**File**: `lib/features/subscription/data/subscription_repository.dart`

Check `verifyPurchase` sends correct fields:
```dart
await _apiClient.post('/subscriptions/verify', data: {
  'productId': productId,        // What are we sending here?
  'purchaseToken': purchaseToken,
});
```

**Question**: Is `productId` the full composite or just subscription ID?

**Answer from code**: The `PlanModel.productId` from server is the composite. When purchasing, we use `ProductDetails.id` which is just the subscription ID.

**Potential Issue**: We need to send the same ID format the server expects.

#### Task 4.3: Add Retry Logic for Verification

If verification fails due to network, the purchase is still valid. Add:
- Local persistence of pending verifications
- Retry on app restart
- Background retry mechanism

---

### Phase 5: Testing Checklist

#### Test Cases

| # | Test Case | Expected Result |
|---|-----------|-----------------|
| 1 | New user purchases subscription | Subscription created, status ACTIVE |
| 2 | Purchase verification with network failure | Purchase queued for retry |
| 3 | Subscription renewal webhook | Subscription dates updated, payment recorded |
| 4 | Subscription cancellation webhook | Status → CANCELED, cancelAtPeriodEnd = true |
| 5 | Subscription expiry webhook | Status → EXPIRED |
| 6 | Restore purchases on new device | Previous subscription linked to user |
| 7 | User with existing subscription purchases again | Existing subscription updated (no duplicate) |

#### Testing Environment

1. **Google Play Console**: Use test tracks (internal/closed testing)
2. **License Testing**: Add test accounts in Play Console → Settings → License Testing
3. **Test Cards**: Google provides test card numbers for sandbox purchases

---

## Database Migration Required

### Migration: Add subscriptionId and basePlanId columns

```sql
-- Add new columns
ALTER TABLE "Plan" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "Plan" ADD COLUMN "basePlanId" TEXT;

-- Populate from existing productId (format: "subscriptionId:basePlanId")
UPDATE "Plan" 
SET 
  "subscriptionId" = SPLIT_PART("productId", ':', 1),
  "basePlanId" = SPLIT_PART("productId", ':', 2);

-- Make subscriptionId required after population
ALTER TABLE "Plan" ALTER COLUMN "subscriptionId" SET NOT NULL;
ALTER TABLE "Plan" ALTER COLUMN "basePlanId" SET NOT NULL;

-- Add index for efficient lookup
CREATE INDEX "Plan_subscriptionId_idx" ON "Plan"("subscriptionId");
```

---

## File Change Summary

### Server Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `subscriptionId`, `basePlanId` to Plan model |
| `src/services/subscription.service.ts` | Update plan matching to use `subscriptionId` |
| `src/providers/payment/google-play.provider.ts` | Verify ID extraction, acknowledgment API usage |
| `src/controllers/subscription.controller.ts` | Ensure correct ID parsing from client |
| `scripts/sync-plans.ts` | Populate new fields when syncing |

### Flutter Files to Verify

| File | Changes |
|------|---------|
| `lib/features/subscription/data/subscription_repository.dart` | Verify productId sent to server |
| `lib/features/subscription/services/in_app_purchase_service.dart` | Verify purchase token extraction |
| `lib/features/subscription/presentation/providers/subscription_provider.dart` | Add retry logic for failed verifications |

---

## Implementation Order

1. **Database Migration** - Add new columns (low risk, additive)
2. **Server: Plan Matching** - Update to use `subscriptionId` field
3. **Server: Sync Script** - Populate new fields
4. **Server: Verify Flow** - Test end-to-end with hardcoded data
5. **Flutter: Verify Payload** - Confirm correct IDs sent
6. **Integration Test** - Full purchase flow in test environment
7. **Webhook Test** - Simulate notifications
8. **Production Deploy** - With feature flag if possible

---

## Quick Reference: Google Play API Versions

| API | Version | Use Case |
|-----|---------|----------|
| `purchases.subscriptionsv2.get` | v2 | Get subscription status (preferred) |
| `purchases.subscriptionsv2.acknowledge` | v2 | Acknowledge purchase |
| `monetization.subscriptions.list` | v3 | List subscription products for sync |

**Note**: The v2 API uses `token` for lookups, not `subscriptionId`. This is correct and handles all base plans under a subscription.

---

## Success Criteria

- [ ] New purchases are verified and stored correctly
- [ ] Subscription status reflects current state from Google Play
- [ ] Webhooks update subscription status in real-time
- [ ] Restore purchases works across devices
- [ ] No duplicate subscriptions for the same purchase
- [ ] Acknowledgment happens within 3 days (Google requirement)
- [ ] Product ID matching is deterministic (no `startsWith` fallbacks)

---

*Created: 2026-02-04*
*Author: Implementation Plan Generator*
