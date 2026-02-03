# Subscription Feature

> **Purpose**: This document describes the subscription system including in-app purchases, webhooks, promo codes, and payment provider integration.

---

## Overview

The subscription system handles:
- **Plans**: Subscription plans synced from payment providers
- **Subscriptions**: User subscription lifecycle management
- **Webhooks**: Real-time notifications from payment providers
- **Promo Codes**: Discount codes and redemption tracking

### Current Providers
- **Google Play Billing**: Android in-app subscriptions

### Architecture Pattern

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Controllers   │────▶│    Services      │────▶│   Providers     │
│                 │     │                  │     │                 │
│ subscription.ts │     │ subscription.ts  │     │ google-play.ts  │
│ webhook.ts      │     │ promo.ts         │     │ (future: apple) │
│ promo.ts        │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   Route handlers          Business logic         External APIs
```

---

## File Structure

```
src/
├── providers/payment/
│   ├── payment.provider.interface.ts  # Provider interface contract
│   ├── google-play.provider.ts        # Google Play implementation
│   └── index.ts                       # Provider factory
├── services/
│   ├── subscription.service.ts        # Subscription business logic
│   └── promo.service.ts               # Promo code business logic
├── controllers/
│   ├── subscription.controller.ts     # Subscription endpoints
│   ├── webhook.controller.ts          # Webhook handlers
│   └── promo.controller.ts            # Promo code endpoints
├── middleware/
│   └── subscription.middleware.ts     # Subscription verification middleware
├── routes/
│   ├── subscription.routes.ts
│   ├── webhook.routes.ts
│   └── promo.routes.ts
└── schemas/
    ├── subscription.schema.ts
    └── promo.schema.ts

scripts/
└── sync-plans.ts                      # Plan sync utility
```

---

## Database Models

### Plan
Represents a subscription plan/product from a payment provider.

```prisma
model Plan {
  id              String          @id
  name            String          @unique
  description     String
  priceCents      Int
  currency        String          @default("PHP")
  billingCycle    BillingCycle    # DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
  features        String[]
  tierLevel       Int             @default(0)  # Access control tier (0=Free, 1=Basic, 2=Premium, etc.)
  provider        PaymentProvider # GOOGLE_PAY
  productId       String          @unique
  trialPeriodDays Int?
  isActive        Boolean         @default(true)
  sortOrder       Int             @default(0)
}
```

#### Tier Levels

The `tierLevel` field enables feature gating based on subscription plans:

| Tier | Name | Description |
|------|------|-------------|
| 0 | Free | No subscription (default) |
| 1 | Basic | Entry-level subscription |
| 2 | Premium | Standard subscription with more features |
| 3 | Pro | Full-featured subscription |

### Subscription
Tracks user subscriptions and their lifecycle.

```prisma
model Subscription {
  id                 String             @id
  userId             String
  planId             String
  subscriptionId     String             @unique  # External ID
  status             SubscriptionStatus # PENDING, ACTIVE, PAST_DUE, CANCELED, EXPIRED, REVOKED
  startDate          DateTime
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  nextBillingDate    DateTime
  cancelAtPeriodEnd  Boolean            @default(false)
  canceledAt         DateTime?
  endedAt            DateTime?
  trialStartDate     DateTime?
  trialEndDate       DateTime?
  orderId            String?            @unique
  purchaseToken      String?            # Google Play token
  autoRenew          Boolean            @default(true)
  metadata           Json?
}
```

### SubscriptionEvent
Audit trail for subscription state changes.

```prisma
model SubscriptionEvent {
  id             String                @id
  subscriptionId String
  eventType      SubscriptionEventType # CREATED, RENEWED, CANCELED, EXPIRED, etc.
  fromStatus     SubscriptionStatus?
  toStatus       SubscriptionStatus?
  triggeredBy    String?               # "user", "system", "webhook", "admin"
  reason         String?
  metadata       Json?
}
```

### WebhookEvent
Logs all incoming webhook payloads for debugging.

```prisma
model WebhookEvent {
  id             String          @id
  provider       PaymentProvider
  eventType      String
  subscriptionId String?
  rawPayload     Json
  status         WebhookStatus   # PENDING, PROCESSING, COMPLETED, FAILED
  errorMessage   String?
  retryCount     Int             @default(0)
  ipAddress      String?
  userAgent      String?
}
```

### PromoCode
Discount codes with usage tracking.

```prisma
model PromoCode {
  id              String       @id
  code            String       @unique
  description     String?
  discountType    DiscountType # PERCENTAGE, FIXED_AMOUNT
  discountValue   Int          # Percentage (0-100) or cents
  validFrom       DateTime
  validUntil      DateTime?
  maxUses         Int?         # Null = unlimited
  currentUses     Int          @default(0)
  applicablePlans String[]     # Plan IDs (empty = all plans)
  firstTimeOnly   Boolean      @default(false)
  isActive        Boolean      @default(true)
}
```

---

## API Endpoints

### Subscription Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/subscriptions/plans` | Get available plans | No |
| `GET` | `/api/subscriptions/status` | Get user's subscription status | Yes |
| `GET` | `/api/subscriptions/history` | Get subscription history | Yes |
| `POST` | `/api/subscriptions/verify` | Verify and process a purchase | Yes |

### Webhook Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/webhooks/health` | Health check | No |
| `POST` | `/api/webhooks/google-play` | Google Play Pub/Sub webhook | No* |

*Webhook endpoints use provider-specific verification.

### Promo Code Endpoints (User)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/promo/validate` | Validate a promo code | Yes |
| `POST` | `/api/promo/redeem` | Redeem a promo code | Yes |
| `GET` | `/api/promo/my-redemptions` | Get user's redemption history | Yes |

### Promo Code Endpoints (Admin)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/promo/admin` | Create a promo code | Yes |
| `GET` | `/api/promo/admin` | List all promo codes | Yes |
| `GET` | `/api/promo/admin/:id` | Get promo code details | Yes |
| `DELETE` | `/api/promo/admin/:id` | Deactivate a promo code | Yes |

---

## Request/Response Examples

### Get Plans

```http
GET /api/subscriptions/plans
```

Response:
```json
{
  "data": {
    "plans": [
      {
        "id": "clxx...",
        "name": "premium_monthly",
        "description": "Premium Monthly",
        "priceCents": 29900,
        "currency": "PHP",
        "billingCycle": "MONTHLY",
        "features": ["Unlimited workouts", "Custom programs"],
        "trialPeriodDays": 7,
        "productId": "premium_monthly:base"
      }
    ]
  },
  "errors": []
}
```

### Verify Purchase

```http
POST /api/subscriptions/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "premium_monthly",
  "purchaseToken": "abc123...",
  "provider": "GOOGLE_PAY"
}
```

Response:
```json
{
  "data": {
    "success": true,
    "subscription": {
      "id": "clxx...",
      "status": "ACTIVE",
      "plan": {
        "id": "clxx...",
        "name": "premium_monthly"
      },
      "currentPeriodEnd": "2026-02-28T00:00:00.000Z"
    }
  },
  "errors": []
}
```

### Get Subscription Status

```http
GET /api/subscriptions/status?includeHistory=true
Authorization: Bearer <token>
```

Response:
```json
{
  "data": {
    "isSubscribed": true,
    "subscription": {
      "id": "clxx...",
      "status": "ACTIVE",
      "plan": {
        "id": "clxx...",
        "name": "premium_monthly",
        "billingCycle": "MONTHLY"
      },
      "currentPeriodStart": "2026-01-01T00:00:00.000Z",
      "currentPeriodEnd": "2026-02-01T00:00:00.000Z",
      "nextBillingDate": "2026-02-01T00:00:00.000Z",
      "cancelAtPeriodEnd": false,
      "autoRenew": true
    },
    "history": [...]
  },
  "errors": []
}
```

### Validate Promo Code

```http
POST /api/promo/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "WELCOME20",
  "planId": "clxx..."
}
```

Response:
```json
{
  "data": {
    "isValid": true,
    "promoCode": {
      "code": "WELCOME20",
      "discountType": "PERCENTAGE",
      "discountValue": 20,
      "description": "20% off first month"
    },
    "exampleDiscount": {
      "originalPriceCents": 29900,
      "discountAmountCents": 5980,
      "finalPriceCents": 23920
    }
  },
  "errors": []
}
```

---

## Provider Pattern

The provider pattern allows easy addition of new payment providers (Apple, Stripe, etc.).

### Interface

```typescript
interface IPaymentProvider {
  readonly provider: PaymentProvider;

  verifyPurchase(productId: string, purchaseToken: string): Promise<VerifyPurchaseResult>;
  acknowledgePurchase(productId: string, purchaseToken: string): Promise<boolean>;
  getSubscription(productId: string, purchaseToken: string): Promise<NormalizedSubscription | null>;
  cancelSubscription(productId: string, purchaseToken: string): Promise<boolean>;
  fetchPlans(): Promise<NormalizedPlan[]>;
  parseWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookEventData | null>;
  mapStatus(providerStatus: number | string): SubscriptionStatus;
}
```

### Getting a Provider

```typescript
import { getPaymentProvider } from '../providers/payment';
import { PaymentProvider } from '../generated/prisma/client';

const provider = getPaymentProvider(PaymentProvider.GOOGLE_PAY);
const result = await provider.verifyPurchase(productId, token);
```

### Adding a New Provider

1. Create `src/providers/payment/<provider>.provider.ts`
2. Implement `IPaymentProvider` interface
3. Add to `PaymentProvider` enum in schema.prisma
4. Register in `src/providers/payment/index.ts`

---

## Google Play Integration

### Setup Requirements

1. **Service Account**: Create in Google Cloud Console with Play Developer API access
2. **Package Name**: Set `GOOGLE_PLAY_PACKAGE_NAME` environment variable
3. **Credentials**: Place service account JSON at project root or set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`

### Real-Time Developer Notifications (RTDN)

Google Play uses Pub/Sub for real-time notifications:

1. Configure Pub/Sub topic in Google Play Console
2. Create push subscription pointing to `/api/webhooks/google-play`
3. Webhook receives notifications for:
   - New purchases
   - Renewals
   - Cancellations
   - Expirations
   - Payment failures

### Notification Types

| Type | Description |
|------|-------------|
| `SUBSCRIPTION_PURCHASED` | New subscription |
| `SUBSCRIPTION_RENEWED` | Successful renewal |
| `SUBSCRIPTION_CANCELED` | User canceled |
| `SUBSCRIPTION_EXPIRED` | Subscription ended |
| `SUBSCRIPTION_ON_HOLD` | Payment failed |
| `SUBSCRIPTION_RECOVERED` | Payment recovered |
| `SUBSCRIPTION_REVOKED` | Refunded/chargedback |

---

## Plan Sync Script

Sync subscription products from payment providers to the database:

```bash
npm run sync:plans
```

The script:
1. Fetches products from Google Play Console
2. Checks for existing plans in database
3. Creates new plans (skips existing ones)
4. Reports results

---

## Flutter Client Integration

The mobile app uses `in_app_purchase` package:

```dart
// 1. Query available products
final products = await InAppPurchase.instance.queryProductDetails({'premium_monthly'});

// 2. Purchase
await InAppPurchase.instance.buyNonConsumable(purchaseParam: PurchaseParam(productDetails: product));

// 3. Verify with server
final response = await api.post('/subscriptions/verify', {
  'productId': purchase.productID,
  'purchaseToken': purchase.purchaseID,
  'provider': 'GOOGLE_PAY',
});

// 4. Complete purchase
await InAppPurchase.instance.completePurchase(purchase);
```

---

## Error Handling

### Purchase Verification Errors

| Error | Description |
|-------|-------------|
| `Purchase verification failed` | Invalid or expired token |
| `Plan not found` | Product not in database |
| `User not found` | Invalid auth token |

### Promo Code Errors

| Error | Description |
|-------|-------------|
| `Promo code not found` | Code doesn't exist |
| `Promo code is no longer active` | Deactivated |
| `Promo code has expired` | Past validUntil date |
| `Promo code has reached maximum uses` | Usage limit hit |
| `Promo code not valid for this plan` | Plan restriction |
| `You have already used this promo code` | Already redeemed |

### Subscription Middleware Errors

| Error | Description |
|-------|-------------|
| `Authentication required` | No authenticated user |
| `Active subscription required` | User has no active subscription |
| `This feature requires a higher subscription tier` | User's tier is below required |

---

## Subscription Middleware

The subscription middleware provides route protection based on subscription status and tier levels.

### Automatic Subscription Data

**Important:** The `authenticateSupabaseUser` middleware automatically attaches subscription data to `req.user.subscription`. This means you can check subscription status and tier level directly in your controllers without additional middleware for simple checks.

```typescript
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import type { AuthenticatedUser } from '../middleware/auth.middleware';

router.get('/content', authenticateSupabaseUser, (req, res) => {
  const user = req.user as AuthenticatedUser;
  
  // Subscription data is already available
  if (user.subscription.tierLevel >= 2) {
    // Return premium content
  } else {
    // Return basic content
  }
});
```

### Available Middleware

Use these middleware when you need to **block access** based on subscription requirements:

#### `requireSubscription(options?)`

Protects routes by requiring an active subscription. Optionally enforce minimum tier level.

**Note:** This middleware uses the subscription data already attached by `authenticateSupabaseUser`, so it's very efficient (no additional database queries).

```typescript
import { requireSubscription } from '../middleware/subscription.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';

// Require any active subscription (tier 1+)
router.get('/premium-content', authenticateSupabaseUser, requireSubscription(), controller);

// Require tier 2 or higher
router.get('/pro-feature', authenticateSupabaseUser, requireSubscription({ minTier: 2 }), controller);
```

**Options:**
- `minTier`: Minimum tier level required (default: 1)

**Response on failure:**
```json
{
  "data": null,
  "errors": [{ "message": "Active subscription required" }]
}
```

#### `attachSubscription`

Attaches subscription info to the request without blocking. Useful for routes that behave differently based on subscription status.

```typescript
import { attachSubscription } from '../middleware/subscription.middleware';

router.get('/content', authenticateSupabaseUser, attachSubscription, (req, res) => {
  if (req.subscription?.isSubscribed) {
    // Return full content
  } else {
    // Return limited content
  }
});
```

**Request object:**
```typescript
req.subscription = {
  isSubscribed: boolean;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    planId: string;
    tierLevel: number;
    currentPeriodEnd: Date;
  } | null;
}
```

#### `checkTier(requiredTier, featureName?)`

Checks subscription tier after `attachSubscription` or `requireSubscription`. Provides descriptive error messages.

```typescript
import { attachSubscription, checkTier } from '../middleware/subscription.middleware';

router.get(
  '/advanced-analytics',
  authenticateSupabaseUser,
  attachSubscription,
  checkTier(2, 'Advanced analytics'),
  controller
);
```

**Response on failure:**
```json
{
  "data": null,
  "errors": [{ "message": "\"Advanced analytics\" requires a tier 2+ subscription" }]
}
```

### Usage Patterns

#### Pattern 1: Direct tier check (recommended for simple logic)

```typescript
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import type { AuthenticatedUser } from '../middleware/auth.middleware';

router.get('/content', authenticateSupabaseUser, (req, res) => {
  const user = req.user as AuthenticatedUser;
  
  // Check tier directly - no extra middleware needed!
  if (user.subscription.tierLevel >= 2) {
    return sendSuccess(res, { content: getPremiumContent() });
  }
  
  return sendSuccess(res, { content: getBasicContent() });
});
```

#### Pattern 2: Blocking access with middleware

```typescript
// Use requireSubscription when you want to block access entirely
router.get('/premium', authenticateSupabaseUser, requireSubscription(), premiumController);
router.get('/pro-only', authenticateSupabaseUser, requireSubscription({ minTier: 3 }), proController);
```

#### Pattern 3: Tiered access

```typescript
// Different endpoints for different tiers
router.get('/basic-stats', authenticateSupabaseUser, requireSubscription({ minTier: 1 }), basicStatsController);
router.get('/advanced-stats', authenticateSupabaseUser, requireSubscription({ minTier: 2 }), advancedStatsController);
router.get('/pro-analytics', authenticateSupabaseUser, requireSubscription({ minTier: 3 }), proAnalyticsController);
```

#### Pattern 4: Conditional content (legacy - use Pattern 1 instead)

```typescript
// This pattern works but Pattern 1 is more efficient
router.get('/workout', authenticateSupabaseUser, attachSubscription, (req, res) => {
  const workout = await getWorkout(req.params.id);
  
  if (req.subscription?.subscription?.tierLevel >= 2) {
    // Include advanced analytics and video
    return sendSuccess(res, { workout, analytics: true, video: workout.videoUrl });
  }
  
  // Basic workout data only
  return sendSuccess(res, { workout, analytics: false, video: null });
});
```

**Note:** `attachSubscription` is now optional since subscription data is automatically available in `req.user.subscription`. Use it only if you need the legacy `req.subscription` format.

---

## Related Documentation

- [CONTEXT.md](../CONTEXT.md) - Core patterns and conventions
- [AUTH.md](AUTH.md) - Authentication and authorization
- [FEATURE_INDEX.md](../FEATURE_INDEX.md) - Feature navigation

---

*Last updated: February 1, 2026*
