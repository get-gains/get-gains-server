# Coach Dashboard Feature

> **Status**: ✅ Documented  
> **Last Updated**: February 1, 2026  
> **Covers**: Class Management (GG-28), Client List, Performance Reports, Program Assignment (GG-29)

---

## Overview

### Purpose

The Coach Dashboard feature provides backend APIs for coaches to manage their class and assign programs to clients:

- **Class Management (GG-28)**: List, add, and remove clients from the coach's roster
- **Client List (GG-29)**: List clients with filters (assigned / unassigned)
- **Performance Reports (GG-29)**: Aggregate client performance (good / falling behind)
- **Program Assignment (GG-29)**: Assign programs to clients

### Scope

**This document covers:**
- Coach indication: `isCoach` in login, refresh, and GET /me
- Coach profile creation (become a coach) via POST /api/coach/profile
- Class roster CRUD (list, add, remove clients) – **only coaches** can create or modify the class (add/remove clients); enforced by `requireCoach` on `/api/coach/*`
- Client list with assigned/unassigned filters
- Performance report dashboard
- Program assignment to clients
- `requireCoach` middleware for coach-only routes

**Not Included:**
- Client invitation/request flow

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | ^7.2.0 | Database operations |
| `zod` | ^4.3.5 | Request validation |
| `express` | ^5.2.1 | HTTP routing |

### Entry Points

| File | Description |
|------|-------------|
| `/src/routes/coach.routes.ts` | Coach route definitions (mounts class routes) |
| `/src/routes/class.routes.ts` | Class roster route definitions |
| `/src/controllers/class.controller.ts` | Class business logic |
| `/src/schemas/class.schema.ts` | Zod validation schemas |
| `/src/middleware/auth.middleware.ts` | `authenticateSupabaseUser`, `requireCoach` |
| `/prisma/schema.prisma` | Coach, SubscribedCoach, AssignedProgram models |

---

## Architecture

### Request Flow (Coach Routes)

```
Request with Authorization: Bearer <token>
    │
    ▼
┌─────────────────────────────────────┐
│     authenticateSupabaseUser        │  Verifies Supabase JWT
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│         requireCoach                │  Looks up User by supabaseId,
│                                     │  loads Coach, returns 403 if none
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│      validateRequest(Schema)        │  Validates body/params/query
└─────────────────────────────────────┘
    │
    ▼
  Controller (req.coach, req.appUser available)
```

### requireCoach Middleware

**Location:** `/src/middleware/auth.middleware.ts`

1. Runs after `authenticateSupabaseUser`
2. Looks up `User` by `supabaseId: req.user.id`
3. Loads `Coach` where `userId = user.id`
4. Returns 403 if user has no Coach profile
5. Attaches `req.appUser` (Prisma User) and `req.coach` (Coach model)

### Coach indication (isCoach)

- **Login** (email/password and login/google): Response includes `user.isCoach` (derived from presence of a Coach row).
- **Refresh** (`GET /api/auth/refresh`): Response includes `user` and `isCoach` so the client stays in sync.
- **GET /api/auth/me**: Returns `{ user, isCoach }` for the authenticated user. Use this to check coach status without calling a coach endpoint. Non-coaches get `isCoach: false`; coaches get `isCoach: true`.

Only coaches can create or modify the class (add/remove clients); all class and coach dashboard routes use `requireCoach` except POST /api/coach/profile.

---

## API Endpoints

### Coach profile creation (become a coach)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/coach/profile` | Create coach profile (become a coach) | Yes (no requireCoach) |

**POST /api/coach/profile** – Body optional. If omitted, name/email are copied from the current user. Optional overrides: `name`, `email`, `avatarUrl`, `bio`, `yearsExperience`, `certifications`, `certificationImageUrls`, `awards`, `specialties`, `socialLinks`. Returns 409 if user is already a coach.

### Class Endpoints (GG-28)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/coach/class` | List coach's clients (roster) | Yes (Coach) |
| `POST` | `/api/coach/class` | Add client to class | Yes (Coach) |
| `DELETE` | `/api/coach/class/:userId` | Remove client from class | Yes (Coach) |

**GET /api/coach/class** – Query parameters: `limit`, `offset`

**POST /api/coach/class** – Body: `{ "userId": "cuid" }`

**DELETE /api/coach/class/:userId** – Path param: `userId` (cuid)

### Coach Dashboard Endpoints (GG-29)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/coach/clients` | List clients with filters (assigned/unassigned) | Yes (Coach) |
| `GET` | `/api/coach/performance` | Performance report (good/falling behind) | Yes (Coach) |
| `POST` | `/api/coach/assign-program` | Assign program to client | Yes (Coach) |

**GET /api/coach/clients** – Query parameters: `filter` (`assigned` | `unassigned`), `limit`, `offset`

**GET /api/coach/performance** – Query parameters: `limit`, `offset`

**POST /api/coach/assign-program** – Body: `{ "userId": "cuid", "programId": "cuid", "startDate": "ISO datetime", "endDate": "ISO datetime" (optional), "notes": "string" (optional) }`

### Program Endpoints (Coach-scoped)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/coach/programs` | Create program | Yes (Coach) |
| `POST` | `/api/coach/programs/:programId/routines` | Assign routine to program | Yes (Coach) |
| `POST` | `/api/coach/programs/routines/:routineId/exercises` | Add exercise to routine | Yes (Coach) |

---

## Database Models

### Key Models

- **Coach**: Coach profile linked to User (1:1)
- **SubscribedCoach**: Junction between User (client) and Coach; `endedAt` indicates removal
- **AssignedProgram**: Links User to Program with start/end dates

### SubscribedCoach

- `startedAt`: When client joined class
- `endedAt`: When client left (null = active)

---

## Related Documentation

- [features/AUTH.md](AUTH.md) – Authentication, `authenticateSupabaseUser`
- [CONTEXT.md](../CONTEXT.md) – Validation, response format
- [FEATURE_INDEX.md](../FEATURE_INDEX.md) – Navigation hub
