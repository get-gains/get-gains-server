# Feature: Subscription Definitions

**Spec**: `/specs/001-subscription-definitions/spec.md`
**Status**: Complete

## Overview

Server-side changes for subscription-aware statistics and session history. New unified API endpoints replace the separate standalone/coach stats and session history calls with source-aware aggregation.

## Endpoints

### `GET /api/stats/weekly` (New)

- **Auth**: `authenticateSupabaseUser` + `attachSubscription` (non-blocking)
- **Purpose**: Returns combined + per-source weekly stats
- **Behavior**: Free users get standalone-only sources; subscribed users get both
- **Contract**: See `/specs/001-subscription-definitions/contracts/unified-weekly-stats.md`

### `GET /api/sessions/history` (New)

- **Auth**: `authenticateSupabaseUser` + `attachSubscription` (non-blocking)
- **Purpose**: Returns paginated session history with source labels
- **Behavior**: All users see all their sessions (no subscription gating on read)
- **Contract**: See `/specs/001-subscription-definitions/contracts/unified-session-history.md`

### Deprecated (Backward Compatible)

- `GET /api/workout/stats/weekly` — Legacy coach stats. Remains operational during migration.
- `GET /api/standalone/stats/weekly` — Legacy standalone stats. Remains operational during migration.

## Key Files

- `src/schemas/stats.schema.ts` — Zod schemas for unified weekly stats
- `src/controllers/stats.controller.ts` — Stats aggregation controller
- `src/routes/stats.routes.ts` — Stats route registration
- `src/schemas/sessions.schema.ts` — Zod schemas for unified session history
- `src/controllers/sessions.controller.ts` — Session history controller with source labeling
- `src/routes/sessions.routes.ts` — Sessions route registration

## Access Control

- Session completion (`POST /sessions/:id/complete`) does NOT use `requireSubscription` (FR-008)
- Standalone routes are free of `requireSubscription` middleware (FR-007)
- `attachSubscription` middleware is non-blocking — always calls `next()`, varies response content (R4)
- Unified endpoints use `attachSubscription` to vary response by subscription status
- PAST_DUE and PENDING treated as non-subscribed server-side

## Implementation Notes

- Source derived from `WorkoutSession.assignedProgramId IS NULL` (standalone) vs `IS NOT NULL` (coach)
- `attachSubscription` middleware is non-blocking — always calls `next()`, varies response content
- Existing endpoints (`/api/workout/stats/weekly`, `/api/standalone/stats/weekly`) remain for backward compatibility
- No Prisma schema changes required
- Session history joins: `WorkoutSession` → `AssignedProgram` → `Program` (for programName) → `User` (for coachName)
- Pagination: `ORDER BY startedAt DESC`, limit max 50
