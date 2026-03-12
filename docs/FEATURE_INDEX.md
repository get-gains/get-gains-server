# Get Gains Server - Feature Index

> **Purpose**: Central navigation hub for all Express server features and documentation.

---

## Overview

**Get Gains Server** is a RESTful Express.js API backend for the Get Gains fitness application (including the Flutter mobile app). It provides authentication, user management, profile, and supporting services. The API is designed to match the [Flutter app API contract](#api-response-envelope--flutter-contract): all responses use a `{ data, errors }` envelope, and key paths (e.g. `/api/users/profile`, `POST /api/auth/refresh`) align with what the app expects.

### Technology Stack

| Technology              | Version | Purpose                 |
| ----------------------- | ------- | ----------------------- |
| **Node.js**             | -       | Runtime environment     |
| **Express.js**          | ^5.2.1  | Web framework           |
| **TypeScript**          | ^5.9.3  | Type-safe JavaScript    |
| **Prisma**              | ^7.2.0  | ORM / Database client   |
| **PostgreSQL**          | -       | Primary database        |
| **Supabase**            | ^2.91.1 | Authentication provider |
| **Zod**                 | ^4.3.5  | Request validation      |
| **Google Auth Library** | ^10.5.0 | Google OAuth            |

### Architecture Approach

- **REST API** with JSON responses
- **Controller-Service pattern** for business logic separation
- **Middleware-based** request validation and authentication
- **Standardized API responses** with consistent `{ data, errors }` structure (see [API response envelope](#api-response-envelope--flutter-contract))
- **Flutter app compatibility**: `/api/users` mount for profile and contract-aligned auth (POST refresh with body, logout)

---

## Documentation Structure

| Document                                                                     | Purpose                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [CONTEXT.md](CONTEXT.md)                                                     | Core infrastructure, patterns, conventions, utilities        |
| [FEATURE_INDEX.md](FEATURE_INDEX.md)                                         | This file - navigation hub                                   |
| [FEATURE_PROMPT.md](FEATURE_PROMPT.md)                                       | Reusable prompt for generating feature docs                  |
| [features/AUTH.md](features/AUTH.md)                                         | Authentication & security feature                            |
| [features/USER.md](features/USER.md)                                         | User profile management (GET/PATCH/PUT)                      |
| [features/USER_PROFILE.md](features/USER_PROFILE.md)                         | Extended user profile CRUD (onboarding, fitness stats)       |
| [features/WORKOUT.md](features/WORKOUT.md)                                   | Workout, exercises, routines, sessions, and set logging      |
| [features/PROGRAM.md](features/PROGRAM.md)                                   | Program creation and routine assignment (coach features)     |
| [features/COACH.md](features/COACH.md)                                       | Coach dashboard, class management                            |
| [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md)                         | Subscriptions, payments, webhooks, and promo codes           |
| [features/POSE_DETECTION.md](features/POSE_DETECTION.md)                     | Pose detection storage, form analysis, limb isolation        |
| [features/STANDALONE_WORKOUT.md](features/STANDALONE_WORKOUT.md)             | Standalone (subscription-free) workout system                |
| [features/VERIFY_RESET_FLOW.md](features/VERIFY_RESET_FLOW.md)               | Email verification & password reset flows                    |
| [features/SUBSCRIPTION_DEFINITIONS.md](features/SUBSCRIPTION_DEFINITIONS.md) | Subscription-aware unified stats & session history endpoints |

---

## Feature Categories

### Core Infrastructure _(Documented in [CONTEXT.md](CONTEXT.md))_

These patterns are documented in CONTEXT.md - no separate feature docs needed:

| Topic                 | Description                          | CONTEXT.md Section                  |
| --------------------- | ------------------------------------ | ----------------------------------- |
| Server Setup          | Express app initialization           | Project Structure                   |
| Routing               | RESTful API route definitions        | `/routes` section                   |
| Controllers           | Business logic handlers              | `/controllers` section              |
| Validation            | Zod-based request validation         | `/schemas` + `/middleware` sections |
| Logger                | Console logging utility              | `/utils` → `logger.ts`              |
| Response Builder      | Standardized API responses           | `/utils` → `response.ts`            |
| Conventions           | File naming, imports, error handling | Conventions section                 |
| Environment Variables | Configuration options                | Environment Variables section       |

### Authentication & Security _(Documented in [features/AUTH.md](features/AUTH.md))_

All auth-related functionality is documented together:

| Feature                  | Description                                               | Status         |
| ------------------------ | --------------------------------------------------------- | -------------- |
| Authentication Endpoints | Register, login, OAuth, password reset                    | ✅ Documented  |
| Token Refresh            | POST /auth/refresh with refresh token in body             | ✅ Updated     |
| Auth Middleware          | JWT Bearer token validation (`authenticateSupabaseUser`)  | ✅ Documented  |
| User Model               | Prisma schema and CRUD operations                         | ✅ Documented  |
| Token Refresh (POST)     | POST /auth/refresh with body `{ refreshToken }` (Flutter) | ✅ Documented  |
| Logout                   | POST /auth/logout (client clears tokens)                  | ✅ Documented  |
| Supabase Integration     | Auth client configuration and methods                     | ✅ Documented  |
| Google OAuth             | ID token verification                                     | ✅ Documented  |
| Email Verification       | Verify email flow with PKCE code exchange                 | ✅ Implemented |
| Password Reset           | Reset password via web app redirect + token exchange      | ✅ Implemented |

**Primary Files:**

- `/src/routes/auth.routes.ts`
- `/src/controllers/auth.controller.ts`
- `/src/controllers/user.controller.ts`
- `/src/middleware/auth.middleware.ts`
- `/src/schemas/auth.schema.ts`
- `/src/config/supabase.ts`
- `/src/config/google.ts`
- `/prisma/schema.prisma`

### User Profile _(Documented in [features/USER_PROFILE.md](features/USER_PROFILE.md))_

Extended fitness profile management (separate from basic User model):

| Feature             | Description                                   | Status        |
| ------------------- | --------------------------------------------- | ------------- |
| Profile Retrieval   | GET /api/profile (returns null if not set up) | ✅ Documented |
| Profile Creation    | POST /api/profile (onboarding)                | ✅ Documented |
| Profile Update      | PATCH/PUT /api/profile                        | ✅ Documented |
| Coach Client Access | GET /api/profile/clients/:userId              | ✅ Documented |
| Response Envelope   | data.profile with errors array                | ✅ Documented |

**Primary Files:**

- `/src/routes/profile.routes.ts`
- `/src/controllers/profile.controller.ts`
- `/src/schemas/profile.schema.ts`
- `/prisma/schema.prisma` (UserProfile model)

### User Profile _(Documented in [features/USER.md](features/USER.md))_

User account management endpoints (basic identity):

| Feature           | Description                               | Status        |
| ----------------- | ----------------------------------------- | ------------- |
| Profile Retrieval | GET /api/users/profile, /api/user/profile | ✅ Documented |
| Profile Update    | PATCH/PUT /api/users/profile              | ✅ Documented |
| Dual Endpoint     | Both /user and /users paths supported     | ✅ Documented |
| Response Envelope | data.user with errors array               | ✅ Documented |

**Primary Files:**

- `/src/routes/user.routes.ts`
- `/src/controllers/user.controller.ts`
- `/src/schemas/user.schema.ts`
- `/src/middleware/auth.middleware.ts`

### Coach Dashboard _(Documented in [features/COACH.md](features/COACH.md))_

| Feature                    | Description                                         | Status        |
| -------------------------- | --------------------------------------------------- | ------------- |
| Coach indication (isCoach) | Login/refresh/me return isCoach                     | ✅ Documented |
| GET /auth/me               | Current user and isCoach                            | ✅ Documented |
| Coach profile creation     | POST /coach/profile (become a coach)                | ✅ Documented |
| User Profile (GET/PATCH)   | GET/PUT/PATCH /api/user/profile, /api/users/profile | ✅ Documented |
| Client Coach Discovery     | Discover/search coaches (public)                    | ✅ Documented |
| Client Coach Subscription  | Subscribe/unsubscribe to coaches (clients)          | ✅ Documented |
| Class Roster               | List and remove clients (coaches)                   | ✅ Documented |
| Client List                | List clients with assigned/unassigned filters       | ✅ Documented |
| Performance Report         | Good/falling behind dashboard                       | ✅ Documented |
| Program Assignment         | Assign programs to clients                          | ✅ Documented |
| Program Management         | Create program, assign routines, add exercises      | ✅ Documented |
| requireAppUser Middleware  | Authenticated user route protection                 | ✅ Documented |
| requireCoach Middleware    | Coach-only route protection                         | ✅ Documented |

### Coach Client Progress _(Documented in [features/COACH_CLIENT_PROGRESS.md](features/COACH_CLIENT_PROGRESS.md))_

Coach-facing endpoints for viewing client workout data, progress, and form analysis:

| Feature                     | Description                                                | Status         |
| --------------------------- | ---------------------------------------------------------- | -------------- |
| Client Session List         | GET /coach/clients/:userId/sessions (paginated)            | ✅ Implemented |
| Client Session Detail       | GET /coach/clients/:userId/sessions/:sessionId             | ✅ Implemented |
| Client Weekly Stats         | GET /coach/clients/:userId/stats/weekly (with delta)       | ✅ Implemented |
| Client Exercise History     | GET /coach/clients/:userId/exercises/:exerciseId/history   | ✅ Implemented |
| Detailed Performance Report | GET /coach/performance/detailed (volume, adherence, trend) | ✅ Implemented |
| Client Form Results         | GET /coach/clients/:userId/form-results                    | ✅ Implemented |

**Primary Files:**

- `/src/routes/coach.routes.ts`
- `/src/controllers/coach.controller.ts`
- `/src/schemas/coach.schema.ts`

**Primary Files:**

- `/src/routes/user.routes.ts` (client coach selection)
- `/src/routes/coach.routes.ts`
- `/src/routes/class.routes.ts`
- `/src/routes/program.routes.ts`
- `/src/controllers/user.controller.ts` (profile, client coach selection)
- `/src/controllers/coach.controller.ts`
- `/src/schemas/user.schema.ts` (client coach selection)
- `/src/schemas/coach.schema.ts`
- `/src/controllers/class.controller.ts`
- `/src/schemas/class.schema.ts`
- `/src/middleware/auth.middleware.ts` (requireAppUser, requireCoach)

### Workout Feature _(Documented in [features/WORKOUT.md](features/WORKOUT.md))_

Core fitness tracking functionality:

| Feature            | Description                                          | Status        |
| ------------------ | ---------------------------------------------------- | ------------- |
| Exercises          | Browse and search exercise library with filtering    | ✅ Documented |
| Exercise CRUD      | Create, update, delete exercises (coach-owned)       | ✅ Documented |
| Exercise Ownership | Coach scoping with `coachId` + `isPublic` visibility | ✅ Documented |
| Routines           | View assigned routines from programs                 | ✅ Documented |
| Workout Sessions   | Start, track, and complete workout sessions          | ✅ Documented |
| Set Logging        | Record individual sets (reps, weight, RPE)           | ✅ Documented |
| Batch Sync         | Offline-first synchronization for mobile             | ✅ Documented |
| Weekly Stats       | Server-side aggregated weekly workout statistics     | ✅ Documented |

**Primary Files:**

- `/src/routes/workout.routes.ts`
- `/src/controllers/workout.controller.ts`
- `/src/schemas/workout.schema.ts`
- `/prisma/schema.prisma` (Exercise, Routine, WorkoutSession, PerformedSet models)

### Program Management _(Documented in [features/PROGRAM.md](features/PROGRAM.md))_

Complete coach program flow — build, manage, assign, and deliver training programs:

| Feature                    | Description                                               | Status        |
| -------------------------- | --------------------------------------------------------- | ------------- |
| Program CRUD               | Create, list, get, update, delete programs                | ✅ Documented |
| Custom Programs            | One-off programs for specific clients (`customForUserId`) | ✅ Documented |
| Routine CRUD (standalone)  | Create, list, get, update, delete reusable routines       | ✅ Documented |
| Assign Routines to Program | ProgramRoutine junction: assign, reorder, remove          | ✅ Documented |
| Add Exercises to Routine   | RoutineExercise junction: add, update, remove             | ✅ Documented |
| Routine Ownership          | `coachId` on Routine model, ownership enforcement         | ✅ Documented |
| Assignment Management      | Assign/view/update/revoke program for clients             | ✅ Documented |
| Today's Workout            | Resolve scheduled routine from day cycling logic          | ✅ Documented |
| Subscription Guards        | `requireSubscription()` on coach-content client routes    | ✅ Documented |

**Primary Files:**

- `/src/routes/program.routes.ts`
- `/src/routes/routine.routes.ts`
- `/src/routes/coach.routes.ts` (assignment management)
- `/src/routes/workout.routes.ts` (client-facing: routines, today, sessions)
- `/src/controllers/program.controller.ts`
- `/src/controllers/coach.controller.ts` (assignment management)
- `/src/controllers/workout.controller.ts` (client-facing)
- `/src/schemas/program.schema.ts`
- `/src/schemas/coach.schema.ts` (assignment schemas)
- `/src/schemas/workout.schema.ts` (today's workout schema)
- `/prisma/schema.prisma` (Program, Routine, ProgramRoutine, RoutineExercise, AssignedProgram models)

### Subscription & Payments _(Documented in [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md))_

In-app purchases, subscriptions, and promo codes:

| Feature               | Description                                    | Status        |
| --------------------- | ---------------------------------------------- | ------------- |
| Plans                 | Subscription plans synced from providers       | ✅ Documented |
| Purchase Verification | Verify and process client purchases            | ✅ Documented |
| Subscription Status   | User subscription lifecycle management         | ✅ Documented |
| Webhooks              | Real-time notifications from payment providers | ✅ Documented |
| Promo Codes           | Discount codes with validation and redemption  | ✅ Documented |
| Provider Pattern      | Extensible payment provider architecture       | ✅ Documented |

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

### Pose Detection & Form Analysis _(Documented in [features/POSE_DETECTION.md](features/POSE_DETECTION.md))_

Backend storage for on-device pose detection analysis:

| Feature               | Description                                        | Status         |
| --------------------- | -------------------------------------------------- | -------------- |
| Coach Form Storage    | Store reference pose landmark data for exercises   | ✅ Implemented |
| Client Result Storage | Persist comparison results and correction feedback | ✅ Implemented |
| Limb Isolation Config | Per-exercise body segment configuration            | ✅ Implemented |
| Offline Form Download | Bulk form data serving for client-side caching     | ✅ Implemented |
| Historical Records    | Client form attempt history and progress queries   | ✅ Implemented |

**Primary Files:**

- `/src/routes/pose.routes.ts`
- `/src/controllers/pose.controller.ts`
- `/src/schemas/pose.schema.ts`
- `/prisma/schema.prisma` (ExerciseForm, ExercisePoseConfig, FormComparisonResult models)

### Standalone Workout _(Documented in [features/STANDALONE_WORKOUT.md](features/STANDALONE_WORKOUT.md))_

Subscription-free, coach-free workout system for individual users:

| Feature                 | Description                                                   | Status        |
| ----------------------- | ------------------------------------------------------------- | ------------- |
| Personal Exercises CRUD | Create, list, update, delete user-owned exercises             | ✅ Documented |
| Personal Routines CRUD  | Build custom routines with exercise prescriptions             | ✅ Documented |
| Routine Exercise Mgmt   | Add, update, remove exercises in routines (junction)          | ✅ Documented |
| Personal Programs CRUD  | Build multi-day training programs                             | ✅ Documented |
| Program Routine Mgmt    | Assign routines to program day slots (junction)               | ✅ Documented |
| Self-Assignment         | Activate/deactivate personal programs (one active at a time)  | ✅ Documented |
| Today's Workout         | Day-cycling routine resolution from active standalone program | ✅ Documented |
| Standalone Sessions     | Start, track, complete sessions (no subscription required)    | ✅ Documented |
| Weekly Stats            | Aggregated weekly stats scoped to all user sessions           | ✅ Documented |

**Primary Files:**

- `/src/routes/standalone.routes.ts`
- `/src/controllers/standalone.controller.ts`
- `/src/schemas/standalone.schema.ts`
- `/prisma/schema.prisma` (Exercise, Routine, Program, AssignedProgram, WorkoutSession models)

### Future Domain Features _(Needs Implementation)_

| Feature           | Description                | Status             | Location |
| ----------------- | -------------------------- | ------------------ | -------- |
| Progress Tracking | User progress and stats    | 🔮 Not Implemented | -        |
| User Settings     | Preferences beyond profile | 🔮 Not Implemented | -        |
| Personal Records  | PR tracking and history    | 🔮 Not Implemented | -        |

---

## API Response Envelope (Flutter contract)

Every API response uses this shape:

- **Success:** `{ "data": <payload>, "errors": [] }`
- **Error:** `{ "data": null, "errors": [{ "field": "optional", "message": "Required" }] }`

The app unwraps `data` and treats non-empty `errors` as failure. 404 and 500 handlers also return this envelope.

---

## API Endpoints Summary

### Core Endpoints

| Method | Endpoint  | Description   | Auth Required |
| ------ | --------- | ------------- | ------------- |
| `GET`  | `/`       | Hello message | No            |
| `GET`  | `/health` | Health check  | No            |

### Authentication Endpoints

| Method | Endpoint                         | Description                                      | Auth Required |
| ------ | -------------------------------- | ------------------------------------------------ | ------------- |
| `POST` | `/api/auth/register`             | Register with email/password                     | No            |
| `POST` | `/api/auth/login`                | Login with email/password                        | No            |
| `POST` | `/api/auth/google`               | Sign in with Google (new user flow)              | No            |
| `POST` | `/api/auth/google/link`          | Link Google account to existing user             | Yes           |
| `POST` | `/api/auth/login/google`         | Login with Google (existing user)                | No            |
| `GET`  | `/api/auth/refresh`              | Refresh token (Bearer)                           | Yes           |
| `POST` | `/api/auth/refresh`              | Refresh token (body `{ refreshToken }`, Flutter) | No            |
| `POST` | `/api/auth/logout`               | Logout (client clears tokens)                    | No            |
| `GET`  | `/api/auth/me`                   | Get current user and isCoach status              | Yes           |
| `POST` | `/api/auth/send-recovery-email`  | Send password recovery email                     | No            |
| `POST` | `/api/auth/reset-password`       | Reset password                                   | Yes           |
| `POST` | `/api/auth/exchange-code`        | Exchange Supabase PKCE code for session tokens   | No            |
| `POST` | `/api/auth/check-email-verified` | Check if user's email is verified                | No            |

### User Profile Endpoints (Flutter contract)

| Method  | Endpoint             | Description                      | Auth Required |
| ------- | -------------------- | -------------------------------- | ------------- |
| `GET`   | `/api/users/profile` | Current user profile (data.user) | Yes           |
| `GET`   | `/api/user/profile`  | Same as above                    | Yes           |
| `PATCH` | `/api/users/profile` | Update name/nickname             | Yes           |
| `PUT`   | `/api/users/profile` | Same as PATCH                    | Yes           |
| `PATCH` | `/api/user/profile`  | Same as above                    | Yes           |

### Client Coach Selection Endpoints

| Method   | Endpoint                       | Description                    | Auth Required |
| -------- | ------------------------------ | ------------------------------ | ------------- |
| `GET`    | `/api/user/coaches`            | Discover/search coaches        | No            |
| `GET`    | `/api/user/coaches/subscribed` | List user's subscribed coaches | Yes           |
| `POST`   | `/api/user/coaches/:coachId`   | Subscribe to a coach           | Yes           |
| `DELETE` | `/api/user/coaches/:coachId`   | Unsubscribe from a coach       | Yes           |

### Coach Endpoints

| Method   | Endpoint                                                               | Description                           | Auth Required |
| -------- | ---------------------------------------------------------------------- | ------------------------------------- | ------------- |
| `POST`   | `/api/coach/profile`                                                   | Create coach profile (become a coach) | Yes           |
| `GET`    | `/api/coach/class`                                                     | List coach's clients                  | Yes (Coach)   |
| `DELETE` | `/api/coach/class/:userId`                                             | Remove client from class              | Yes (Coach)   |
| `GET`    | `/api/coach/clients`                                                   | List clients with filters             | Yes (Coach)   |
| `GET`    | `/api/coach/clients/:userId/programs`                                  | List client's program assignments     | Yes (Coach)   |
| `GET`    | `/api/coach/performance`                                               | Performance report                    | Yes (Coach)   |
| `POST`   | `/api/coach/assign-program`                                            | Assign program to client              | Yes (Coach)   |
| `PATCH`  | `/api/coach/assign-program/:assignmentId`                              | Update assignment                     | Yes (Coach)   |
| `DELETE` | `/api/coach/assign-program/:assignmentId`                              | Delete assignment                     | Yes (Coach)   |
| `POST`   | `/api/coach/programs`                                                  | Create program                        | Yes (Coach)   |
| `GET`    | `/api/coach/programs`                                                  | List coach's programs                 | Yes (Coach)   |
| `GET`    | `/api/coach/programs/:programId`                                       | Get program with full tree            | Yes (Coach)   |
| `PATCH`  | `/api/coach/programs/:programId`                                       | Update program                        | Yes (Coach)   |
| `DELETE` | `/api/coach/programs/:programId`                                       | Delete program                        | Yes (Coach)   |
| `POST`   | `/api/coach/programs/:programId/routines`                              | Assign routine to program day         | Yes (Coach)   |
| `PATCH`  | `/api/coach/programs/:programId/routines/:programRoutineId`            | Reassign day number                   | Yes (Coach)   |
| `DELETE` | `/api/coach/programs/:programId/routines/:programRoutineId`            | Remove routine from program           | Yes (Coach)   |
| `POST`   | `/api/coach/programs/routines/:routineId/exercises`                    | Add exercise to routine               | Yes (Coach)   |
| `PATCH`  | `/api/coach/programs/routines/:routineId/exercises/:routineExerciseId` | Update exercise prescription          | Yes (Coach)   |
| `DELETE` | `/api/coach/programs/routines/:routineId/exercises/:routineExerciseId` | Remove exercise from routine          | Yes (Coach)   |
| `POST`   | `/api/coach/routines`                                                  | Create standalone routine             | Yes (Coach)   |
| `GET`    | `/api/coach/routines`                                                  | List coach's routines                 | Yes (Coach)   |
| `GET`    | `/api/coach/routines/:routineId`                                       | Get routine with exercises            | Yes (Coach)   |
| `PATCH`  | `/api/coach/routines/:routineId`                                       | Update routine                        | Yes (Coach)   |
| `DELETE` | `/api/coach/routines/:routineId`                                       | Delete routine                        | Yes (Coach)   |

### Coach Client Progress Endpoints _(New)_

| Method | Endpoint                                                   | Description                                | Auth Required |
| ------ | ---------------------------------------------------------- | ------------------------------------------ | ------------- |
| `GET`  | `/api/coach/clients/:userId/sessions`                      | List client's workout sessions             | Yes (Coach)   |
| `GET`  | `/api/coach/clients/:userId/sessions/:sessionId`           | Client session detail with performed sets  | Yes (Coach)   |
| `GET`  | `/api/coach/clients/:userId/stats/weekly`                  | Client weekly stats with delta             | Yes (Coach)   |
| `GET`  | `/api/coach/clients/:userId/exercises/:exerciseId/history` | Client exercise-level progress over time   | Yes (Coach)   |
| `GET`  | `/api/coach/performance/detailed`                          | Enhanced performance with volume/adherence | Yes (Coach)   |
| `GET`  | `/api/coach/clients/:userId/form-results`                  | Client form comparison result history      | Yes (Coach)   |

### Workout Endpoints

| Method   | Endpoint                                    | Description                         | Auth Required      |
| -------- | ------------------------------------------- | ----------------------------------- | ------------------ |
| `GET`    | `/api/workout/exercises`                    | Get exercises with filtering        | Yes                |
| `POST`   | `/api/workout/exercises`                    | Create exercise (coach only)        | Yes (Coach)        |
| `PATCH`  | `/api/workout/exercises/:exerciseId`        | Update exercise (coach only, owner) | Yes (Coach)        |
| `DELETE` | `/api/workout/exercises/:exerciseId`        | Delete exercise (coach only, owner) | Yes (Coach)        |
| `GET`    | `/api/workout/routines`                     | Get coach-assigned routines         | Yes + Subscription |
| `GET`    | `/api/workout/routines/:routineId`          | Get single routine by ID            | Yes + Subscription |
| `GET`    | `/api/workout/today`                        | Get today's scheduled workout       | Yes + Subscription |
| `POST`   | `/api/workout/sessions`                     | Start a new workout session         | Yes + Subscription |
| `GET`    | `/api/workout/sessions/active`              | Get active workout session          | Yes                |
| `GET`    | `/api/workout/sessions`                     | Get workout session history         | Yes                |
| `GET`    | `/api/workout/sessions/:sessionId`          | Get session by ID                   | Yes                |
| `POST`   | `/api/workout/sessions/:sessionId/complete` | Complete a workout session          | Yes                |
| `GET`    | `/api/workout/stats/weekly`                 | Get weekly workout stats            | Yes                |
| `POST`   | `/api/workout/sets`                         | Log a new set                       | Yes                |
| `PUT`    | `/api/workout/sets/:setId`                  | Update an existing set              | Yes                |
| `DELETE` | `/api/workout/sets/:setId`                  | Delete a set                        | Yes                |
| `POST`   | `/api/workout/sets/sync`                    | Batch sync offline sets             | Yes                |

### Standalone Workout Endpoints

| Method   | Endpoint                                                           | Description                     | Auth Required |
| -------- | ------------------------------------------------------------------ | ------------------------------- | ------------- |
| `POST`   | `/api/standalone/exercises`                                        | Create a personal exercise      | Yes           |
| `GET`    | `/api/standalone/exercises`                                        | List user's + public exercises  | Yes           |
| `PATCH`  | `/api/standalone/exercises/:exerciseId`                            | Update own exercise             | Yes           |
| `DELETE` | `/api/standalone/exercises/:exerciseId`                            | Delete own exercise             | Yes           |
| `POST`   | `/api/standalone/routines`                                         | Create a personal routine       | Yes           |
| `GET`    | `/api/standalone/routines`                                         | List user's routines            | Yes           |
| `GET`    | `/api/standalone/routines/:routineId`                              | Get routine with exercises      | Yes           |
| `PATCH`  | `/api/standalone/routines/:routineId`                              | Update routine metadata         | Yes           |
| `DELETE` | `/api/standalone/routines/:routineId`                              | Delete routine                  | Yes           |
| `POST`   | `/api/standalone/routines/:routineId/exercises`                    | Add exercise to routine         | Yes           |
| `PATCH`  | `/api/standalone/routines/:routineId/exercises/:routineExerciseId` | Update exercise prescription    | Yes           |
| `DELETE` | `/api/standalone/routines/:routineId/exercises/:routineExerciseId` | Remove exercise from routine    | Yes           |
| `POST`   | `/api/standalone/programs`                                         | Create a personal program       | Yes           |
| `GET`    | `/api/standalone/programs`                                         | List user's programs            | Yes           |
| `GET`    | `/api/standalone/programs/active`                                  | Get active program assignment   | Yes           |
| `GET`    | `/api/standalone/programs/:programId`                              | Get program with full tree      | Yes           |
| `PATCH`  | `/api/standalone/programs/:programId`                              | Update program name/description | Yes           |
| `DELETE` | `/api/standalone/programs/:programId`                              | Delete program                  | Yes           |
| `POST`   | `/api/standalone/programs/:programId/routines`                     | Assign routine to program day   | Yes           |
| `PATCH`  | `/api/standalone/programs/:programId/routines/:programRoutineId`   | Update day number               | Yes           |
| `DELETE` | `/api/standalone/programs/:programId/routines/:programRoutineId`   | Remove routine from program     | Yes           |
| `POST`   | `/api/standalone/programs/:programId/activate`                     | Activate a personal program     | Yes           |
| `POST`   | `/api/standalone/programs/:programId/deactivate`                   | Deactivate a program            | Yes           |
| `GET`    | `/api/standalone/today`                                            | Get today's scheduled workout   | Yes           |
| `POST`   | `/api/standalone/sessions`                                         | Start a workout session         | Yes           |
| `GET`    | `/api/standalone/sessions/active`                                  | Get active session              | Yes           |
| `GET`    | `/api/standalone/sessions`                                         | List past sessions              | Yes           |
| `GET`    | `/api/standalone/sessions/:sessionId`                              | Get session detail              | Yes           |
| `POST`   | `/api/standalone/sessions/:sessionId/complete`                     | Complete a session              | Yes           |
| `GET`    | `/api/standalone/stats/weekly`                                     | Get weekly workout stats        | Yes           |

### Subscription Endpoints

| Method | Endpoint                     | Description                      | Auth Required |
| ------ | ---------------------------- | -------------------------------- | ------------- |
| `GET`  | `/api/subscriptions/plans`   | Get available subscription plans | No            |
| `GET`  | `/api/subscriptions/status`  | Get user's subscription status   | Yes           |
| `GET`  | `/api/subscriptions/history` | Get subscription history         | Yes           |
| `POST` | `/api/subscriptions/verify`  | Verify and process a purchase    | Yes           |

### Webhook Endpoints

| Method | Endpoint                    | Description                 | Auth Required |
| ------ | --------------------------- | --------------------------- | ------------- |
| `GET`  | `/api/webhooks/health`      | Webhook health check        | No            |
| `POST` | `/api/webhooks/google-play` | Google Play Pub/Sub webhook | No\*          |

\*Uses provider-specific verification.

### Promo Code Endpoints

| Method   | Endpoint                    | Description                     | Auth Required |
| -------- | --------------------------- | ------------------------------- | ------------- |
| `POST`   | `/api/promo/validate`       | Validate a promo code           | Yes           |
| `POST`   | `/api/promo/redeem`         | Redeem a promo code             | Yes           |
| `GET`    | `/api/promo/my-redemptions` | Get user's redemption history   | Yes           |
| `POST`   | `/api/promo/admin`          | Create a promo code (admin)     | Yes           |
| `GET`    | `/api/promo/admin`          | List all promo codes (admin)    | Yes           |
| `GET`    | `/api/promo/admin/:id`      | Get promo code details (admin)  | Yes           |
| `DELETE` | `/api/promo/admin/:id`      | Deactivate a promo code (admin) | Yes           |

### Pose Detection Endpoints

| Method   | Endpoint                                  | Description                         | Auth Required |
| -------- | ----------------------------------------- | ----------------------------------- | ------------- |
| `POST`   | `/api/pose/forms`                         | Upload coach reference form         | Yes (Coach)   |
| `GET`    | `/api/pose/forms/:formId`                 | Get a specific form by ID           | Yes (Coach)   |
| `GET`    | `/api/pose/exercises/:exerciseId/forms`   | Get all forms for an exercise       | Yes (Coach)   |
| `PUT`    | `/api/pose/forms/:formId`                 | Update/replace a form               | Yes (Coach)   |
| `DELETE` | `/api/pose/forms/:formId`                 | Delete a form                       | Yes (Coach)   |
| `PATCH`  | `/api/pose/forms/:formId/activate`        | Set form as active version          | Yes (Coach)   |
| `PUT`    | `/api/pose/exercises/:exerciseId/config`  | Create/update pose config           | Yes (Coach)   |
| `GET`    | `/api/pose/exercises/:exerciseId/config`  | Get pose config for exercise        | Yes           |
| `POST`   | `/api/pose/results`                       | Submit comparison result            | Yes           |
| `GET`    | `/api/pose/results`                       | Get user's comparison history       | Yes           |
| `GET`    | `/api/pose/results/:resultId`             | Get a specific result               | Yes           |
| `GET`    | `/api/pose/results/exercise/:exerciseId`  | Get results for an exercise         | Yes           |
| `GET`    | `/api/pose/results/session/:sessionId`    | Get results from a workout session  | Yes           |
| `GET`    | `/api/pose/download/program/:programId`   | Bulk download forms for a program   | Yes           |
| `GET`    | `/api/pose/download/exercise/:exerciseId` | Download form for a single exercise | Yes           |

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

| Looking for...               | Go to...                                                                |
| ---------------------------- | ----------------------------------------------------------------------- |
| API response format          | [CONTEXT.md](CONTEXT.md) → Response utility section                     |
| Validation patterns          | [CONTEXT.md](CONTEXT.md) → Schemas section                              |
| Auth endpoints & flows       | [features/AUTH.md](features/AUTH.md)                                    |
| Protecting routes            | [features/AUTH.md](features/AUTH.md) → Auth Middleware                  |
| User model                   | [features/AUTH.md](features/AUTH.md) → User Model                       |
| User profile (GET/PATCH)     | [features/USER.md](features/USER.md)                                    |
| API response envelope        | This file → API Response Envelope                                       |
| Exercises & routines         | [features/WORKOUT.md](features/WORKOUT.md)                              |
| Workout sessions & sets      | [features/WORKOUT.md](features/WORKOUT.md) → API Endpoints              |
| Offline sync (batch sets)    | [features/WORKOUT.md](features/WORKOUT.md) → Offline Sync               |
| Program creation             | [features/PROGRAM.md](features/PROGRAM.md)                              |
| Adding exercises to routines | [features/PROGRAM.md](features/PROGRAM.md)                              |
| Coach features               | [features/COACH.md](features/COACH.md)                                  |
| Subscriptions & purchases    | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md)                    |
| Payment providers            | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) → Provider Pattern |
| Promo codes                  | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) → Promo Codes      |
| Webhooks                     | [features/SUBSCRIPTION.md](features/SUBSCRIPTION.md) → Webhooks         |
| Pose detection & form data   | [features/POSE_DETECTION.md](features/POSE_DETECTION.md)                |
| Limb isolation config        | [features/POSE_DETECTION.md](features/POSE_DETECTION.md) → Config       |
| Standalone workouts          | [features/STANDALONE_WORKOUT.md](features/STANDALONE_WORKOUT.md)        |
| Personal exercises/routines  | [features/STANDALONE_WORKOUT.md](features/STANDALONE_WORKOUT.md)        |
| Self-assigned programs       | [features/STANDALONE_WORKOUT.md](features/STANDALONE_WORKOUT.md)        |
| Environment variables        | [CONTEXT.md](CONTEXT.md) → Environment Variables                        |
| File naming conventions      | [CONTEXT.md](CONTEXT.md) → Conventions                                  |
| Generating new feature docs  | [FEATURE_PROMPT.md](FEATURE_PROMPT.md)                                  |

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

| Status             | Meaning                                    |
| ------------------ | ------------------------------------------ |
| ✅ Documented      | Complete documentation available           |
| 🚧 Partial         | Some documentation exists, needs expansion |
| ⚠️ Needs Docs      | Feature exists but not yet documented      |
| 🔮 Not Implemented | Future feature, not in codebase            |

---

## System Flow Diagrams

Cross-cutting system diagrams covering authentication, coach-client management, workouts, subscriptions, and webhook processing are maintained at the monorepo level:

- **Index**: [`docs/system-diagrams/README.md`](../../docs/system-diagrams/README.md)
- **Authentication flows**: [`docs/system-diagrams/02-authentication.md`](../../docs/system-diagrams/02-authentication.md)
- **Coach-client management**: [`docs/system-diagrams/03-coach-client.md`](../../docs/system-diagrams/03-coach-client.md)
- **Subscriptions & webhooks**: [`docs/system-diagrams/06-subscriptions.md`](../../docs/system-diagrams/06-subscriptions.md)
- **Programs & routines**: [`docs/system-diagrams/04-programs-routines.md`](../../docs/system-diagrams/04-programs-routines.md)

---

_Last updated: March 11, 2026_
