# Get Gains Server - Feature Index

> **Purpose**: Central navigation hub for all Express server features and documentation.

---

## Overview

**Get Gains Server** is a RESTful Express.js API backend for the Get Gains fitness application. It provides authentication, user management, and supporting services for the mobile app.

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | - | Runtime environment |
| **Express.js** | ^5.2.1 | Web framework |
| **TypeScript** | ^5.9.3 | Type-safe JavaScript |
| **Prisma** | ^7.2.0 | ORM / Database client |
| **PostgreSQL** | - | Primary database |
| **Supabase** | ^2.91.1 | Authentication provider |
| **Zod** | ^4.3.5 | Request validation |
| **Google Auth Library** | ^10.5.0 | Google OAuth |

### Architecture Approach

- **REST API** with JSON responses
- **Controller-Service pattern** for business logic separation
- **Middleware-based** request validation and authentication
- **Standardized API responses** with consistent `{ data, errors }` structure

---

## Documentation Structure

| Document | Purpose |
|----------|---------|
| [CONTEXT.md](CONTEXT.md) | Core infrastructure, patterns, conventions, utilities |
| [FEATURE_INDEX.md](FEATURE_INDEX.md) | This file - navigation hub |
| [FEATURE_PROMPT.md](FEATURE_PROMPT.md) | Reusable prompt for generating feature docs |
| [features/AUTH.md](features/AUTH.md) | Authentication & security feature |
| [features/WORKOUT.md](features/WORKOUT.md) | Workout, exercises, routines, sessions, and set logging |
| [features/PROGRAM.md](features/PROGRAM.md) | Program creation and routine assignment (coach features) |
| [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) | Subscriptions, payments, webhooks, and promo codes |
---

## Feature Categories

### Core Infrastructure *(Documented in [CONTEXT.md](CONTEXT.md))*

These patterns are documented in CONTEXT.md - no separate feature docs needed:

| Topic | Description | CONTEXT.md Section |
|-------|-------------|-------------------|
| Server Setup | Express app initialization | Project Structure |
| Routing | RESTful API route definitions | `/routes` section |
| Controllers | Business logic handlers | `/controllers` section |
| Validation | Zod-based request validation | `/schemas` + `/middleware` sections |
| Logger | Console logging utility | `/utils` → `logger.ts` |
| Response Builder | Standardized API responses | `/utils` → `response.ts` |
| Conventions | File naming, imports, error handling | Conventions section |
| Environment Variables | Configuration options | Environment Variables section |

### Authentication & Security *(Documented in [features/AUTH.md](features/AUTH.md))*

All auth-related functionality is documented together:

| Feature | Description | Status |
|---------|-------------|--------|
| Authentication Endpoints | Register, login, OAuth, password reset | ✅ Documented |
| Auth Middleware | JWT Bearer token validation (`authenticateSupabaseUser`) | ✅ Documented |
| User Model | Prisma schema and CRUD operations | ✅ Documented |
| Supabase Integration | Auth client configuration and methods | ✅ Documented |
| Google OAuth | ID token verification | ✅ Documented |

**Primary Files:**
- `/src/routes/auth.routes.ts`
- `/src/controllers/auth.controller.ts`
- `/src/controllers/user.controller.ts`
- `/src/middleware/auth.middleware.ts`
- `/src/schemas/auth.schema.ts`
- `/src/config/supabase.ts`
- `/src/config/google.ts`
- `/prisma/schema.prisma`

### Workout Feature *(Documented in [features/WORKOUT.md](features/WORKOUT.md))*

Core fitness tracking functionality:

| Feature | Description | Status |
|---------|-------------|--------|
| Exercises | Browse and search exercise library with filtering | ✅ Documented |
| Routines | View assigned routines from programs | ✅ Documented |
| Workout Sessions | Start, track, and complete workout sessions | ✅ Documented |
| Set Logging | Record individual sets (reps, weight, RPE) | ✅ Documented |
| Batch Sync | Offline-first synchronization for mobile | ✅ Documented |

**Primary Files:**
- `/src/routes/workout.routes.ts`
- `/src/controllers/workout.controller.ts`
- `/src/schemas/workout.schema.ts`
- `/prisma/schema.prisma` (Exercise, Routine, WorkoutSession, PerformedSet models)

### Program Management *(Documented in [features/PROGRAM.md](features/PROGRAM.md))*

Coach-facing program creation features:

| Feature | Description | Status |
|---------|-------------|--------|
| Create Program | Create training programs | ✅ Documented |
| Assign Routines | Assign routines to program days | ✅ Documented |
| Add Exercises | Add exercises to routines | ✅ Documented |

**Primary Files:**
- `/src/routes/program.routes.ts`
- `/src/controllers/program.controller.ts`
- `/src/schemas/program.schema.ts`
- `/prisma/schema.prisma` (Program, ProgramRoutine, RoutineExercise models)

### Subscription & Payments *(Documented in [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md))*

In-app purchases, subscriptions, and promo codes:

| Feature | Description | Status |
|---------|-------------|--------|
| Plans | Subscription plans synced from providers | ✅ Documented |
| Purchase Verification | Verify and process client purchases | ✅ Documented |
| Subscription Status | User subscription lifecycle management | ✅ Documented |
| Webhooks | Real-time notifications from payment providers | ✅ Documented |
| Promo Codes | Discount codes with validation and redemption | ✅ Documented |
| Provider Pattern | Extensible payment provider architecture | ✅ Documented |

**Primary Files:**
- `/src/providers/payment/` (Payment provider implementations)
- `/src/services/subscription.service.ts`
- `/src/services/promo.service.ts`
- `/src/controllers/subscription.controller.ts`
- `/src/controllers/webhook.controller.ts`
- `/src/controllers/promo.controller.ts`
- `/src/routes/subscription.routes.ts`
- `/src/routes/webhook.routes.ts`
- `/src/routes/promo.routes.ts`
- `/scripts/sync-plans.ts`
- `/prisma/schema.prisma` (Plan, Subscription, PaymentHistory, WebhookEvent, PromoCode models)

### Future Domain Features *(Needs Implementation)*

| Feature | Description | Status | Location |
|---------|-------------|--------|----------|
| Progress Tracking | User progress and stats | 🔮 Not Implemented | - |
| User Settings | Preferences and profile | 🔮 Not Implemented | - |
| Personal Records | PR tracking and history | 🔮 Not Implemented | - |

---

## API Endpoints Summary

### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/` | Hello message | No |
| `GET` | `/health` | Health check | No |

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register with email/password | No |
| `POST` | `/api/auth/login` | Login with email/password | No |
| `POST` | `/api/auth/google` | Sign in with Google (new user flow) | No |
| `POST` | `/api/auth/google/link` | Link Google account to existing user | Yes |
| `POST` | `/api/auth/login/google` | Login with Google (existing user) | No |
| `GET` | `/api/auth/refresh` | Refresh access token | Yes |
| `POST` | `/api/auth/send-recovery-email` | Send password recovery email | No |
| `POST` | `/api/auth/reset-password` | Reset password | Yes |

### Workout Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/workout/exercises` | Get exercises with filtering | Yes |
| `GET` | `/api/workout/routines` | Get user's assigned routines | Yes |
| `GET` | `/api/workout/routines/:routineId` | Get single routine by ID | Yes |
| `POST` | `/api/workout/sessions` | Start a new workout session | Yes |
| `GET` | `/api/workout/sessions/active` | Get active workout session | Yes |
| `GET` | `/api/workout/sessions` | Get workout session history | Yes |
| `GET` | `/api/workout/sessions/:sessionId` | Get session by ID | Yes |
| `POST` | `/api/workout/sessions/:sessionId/complete` | Complete a workout session | Yes |
| `POST` | `/api/workout/sets` | Log a new set | Yes |
| `PUT` | `/api/workout/sets/:setId` | Update an existing set | Yes |
| `DELETE` | `/api/workout/sets/:setId` | Delete a set | Yes |
| `POST` | `/api/workout/sets/sync` | Batch sync offline sets | Yes |

### Program Endpoints (Coach)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/programs` | Create a workout program | Yes |
| `POST` | `/api/programs/:programId/routines` | Assign routine to program day | Yes |
| `POST` | `/api/programs/routines/:routineId/exercises` | Add exercise to routine | Yes |

### Subscription Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/subscriptions/plans` | Get available subscription plans | No |
| `GET` | `/api/subscriptions/status` | Get user's subscription status | Yes |
| `GET` | `/api/subscriptions/history` | Get subscription history | Yes |
| `POST` | `/api/subscriptions/verify` | Verify and process a purchase | Yes |

### Webhook Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/webhooks/health` | Webhook health check | No |
| `POST` | `/api/webhooks/google-play` | Google Play Pub/Sub webhook | No* |

*Uses provider-specific verification.

### Promo Code Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/promo/validate` | Validate a promo code | Yes |
| `POST` | `/api/promo/redeem` | Redeem a promo code | Yes |
| `GET` | `/api/promo/my-redemptions` | Get user's redemption history | Yes |
| `POST` | `/api/promo/admin` | Create a promo code (admin) | Yes |
| `GET` | `/api/promo/admin` | List all promo codes (admin) | Yes |
| `GET` | `/api/promo/admin/:id` | Get promo code details (admin) | Yes |
| `DELETE` | `/api/promo/admin/:id` | Deactivate a promo code (admin) | Yes |

---

## Quick Start Guide

### How to Navigate Documentation

1. **New to the codebase?** Start with [CONTEXT.md](CONTEXT.md) for patterns and conventions
2. **Working on auth?** See [features/AUTH.md](features/AUTH.md) for complete auth documentation
3. **Adding a new feature?** Use [FEATURE_PROMPT.md](FEATURE_PROMPT.md) to generate documentation

### Common Workflows

#### Adding a New Endpoint

1. **Define schema** in `/src/schemas/<resource>.schema.ts`
2. **Create controller** in `/src/controllers/<resource>.controller.ts`
3. **Define routes** in `/src/routes/<resource>.routes.ts`
4. **Register routes** in `/src/index.ts`

See [CONTEXT.md](CONTEXT.md) for detailed examples.

#### Adding a Protected Route

```typescript
import { authenticateSupabaseUser } from '../middleware/auth.middleware';

router.get('/protected', authenticateSupabaseUser, myController);
```

See [features/AUTH.md](features/AUTH.md) → Auth Middleware section for full details.

#### Understanding Request Flow

```
Request → CORS → JSON Parser → Route Matcher → Validation Middleware → Auth Middleware → Controller → Response
```

### Where to Find Information

| Looking for... | Go to... |
|----------------|----------|
| API response format | [CONTEXT.md](CONTEXT.md) → Response utility section |
| Validation patterns | [CONTEXT.md](CONTEXT.md) → Schemas section |
| Auth endpoints & flows | [features/AUTH.md](features/AUTH.md) |
| Protecting routes | [features/AUTH.md](features/AUTH.md) → Auth Middleware |
| User model | [features/AUTH.md](features/AUTH.md) → User Model |
| Exercises & routines | [features/WORKOUT.md](features/WORKOUT.md) |
| Workout sessions & sets | [features/WORKOUT.md](features/WORKOUT.md) → API Endpoints |
| Offline sync (batch sets) | [features/WORKOUT.md](features/WORKOUT.md) → Offline Sync |
| Program creation | [features/PROGRAM.md](features/PROGRAM.md) |
| Adding exercises to routines | [features/PROGRAM.md](features/PROGRAM.md) |
| Subscriptions & purchases | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) |
| Payment providers | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) → Provider Pattern |
| Promo codes | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) → Promo Codes |
| Webhooks | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) → Webhooks |
| Environment variables | [CONTEXT.md](CONTEXT.md) → Environment Variables |
| File naming conventions | [CONTEXT.md](CONTEXT.md) → Conventions |
| Generating new feature docs | [FEATURE_PROMPT.md](FEATURE_PROMPT.md) |

---

## Documentation Conventions

### Documentation Hierarchy

```
CONTEXT.md          → Core patterns, conventions, utilities (always check first)
FEATURE_INDEX.md    → Navigation hub (this file)
FEATURE_PROMPT.md   → Reusable prompt template for generating docs
features/*.md       → Domain-specific feature documentation
```

### When to Create Feature Docs

**Create a new feature doc when:**
- Adding a new domain feature (e.g., Workouts, Progress)
- The feature has multiple related components (routes, controllers, models)
- The feature needs detailed API reference

**Don't create separate docs for:**
- Utilities already in CONTEXT.md (logger, response builder, validation)
- Tightly coupled sub-features (document together, e.g., Auth + Auth Middleware)
- Simple patterns that fit in CONTEXT.md

### Feature Doc Structure

1. **Overview** - Purpose, scope, dependencies, entry points
2. **Architecture** - Component relationships and data flow
3. **Request Flow** - ASCII diagrams for API features
4. **Implementation Details** - Key functions with code
5. **API Reference** - Endpoints, request/response examples
6. **Configuration** - Environment variables
7. **Error Handling** - Error codes and scenarios
8. **Security** - If applicable
9. **Related Documentation** - Links to CONTEXT.md and other docs
10. **Usage Examples** - Client-side integration

### Documentation Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Documented | Complete documentation available |
| 🚧 Partial | Some documentation exists, needs expansion |
| ⚠️ Needs Docs | Feature exists but not yet documented |
| 🔮 Not Implemented | Future feature, not in codebase |

---

*Last updated: January 31, 2026*
