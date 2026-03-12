# Feature Documentation Prompt

> **Purpose**: Reusable prompt template for generating feature documentation.

---

## Usage

Copy the prompt below and replace the placeholders:

- `[FEATURE_NAME]` - The feature to document (e.g., "Authentication", "User Management")
- `[FEATURE_CATEGORY]` - The category (e.g., "Auth & Security", "Data Layer")
- `[PRIMARY_FILES]` - List the main files to analyze

---

## The Prompt

```
I need you to document the [FEATURE_NAME] feature for my Express server.

**Feature Category:** [FEATURE_CATEGORY]

**Primary Files to Analyze:**
- [PRIMARY_FILES]

**Instructions:**

1. **Analyze the feature comprehensively** by examining:
   - All related files (routes, controllers, middleware, schemas, config)
   - Dependencies and connections to other features
   - Database models involved (check prisma/schema.prisma)
   - External service integrations (Supabase, Google, etc.)
   - Utility usage (logger, response builder)

2. **Document ALL connected components** in a single feature doc:
   - If documenting Auth, include Auth Middleware, related schemas, and models
   - If documenting a Data feature, include the Prisma model and related controllers
   - Cross-reference but don't create separate docs for tightly coupled features

3. **Check existing documentation first:**
   - Review /docs/CONTEXT.md for patterns already documented
   - Review /docs/FEATURE_INDEX.md for existing feature docs and API contract
   - Don't duplicate what's already in CONTEXT.md - reference it instead
   - Ensure API responses use the standard envelope: `{ data, errors }` (see FEATURE_INDEX.md → API Response Envelope)

4. **Create/Update the feature documentation** with these sections:

   ## Overview
   - Purpose: What problem does this feature solve?
   - Scope: What's included (and what related features are documented here)
   - Dependencies: Required packages, other features, external services
   - Entry Points: Main files/routes to understand this feature

   ## Architecture
   - Component diagram or file relationships
   - How components connect and communicate
   - Data flow between components

   ## Request Flow (for API features)
   - ASCII diagrams showing the request pipeline
   - Each step with the responsible component
   - Decision points and branches

   ## Implementation Details
   - Key functions/methods with code examples
   - Configuration options
   - Database models (if applicable)

   ## API Reference (for endpoint features)
   - All endpoints with method, path, description
   - Request/response examples (use envelope: `{ data, errors }`)
   - Error responses (always `{ data: null, errors: [{ message, field? }] }`)

   ## Configuration
   - Environment variables
   - Setup requirements

   ## Error Handling
   - Error codes and scenarios
   - How errors are logged and returned

   ## Security Considerations (if applicable)
   - Authentication/authorization requirements
   - Data validation
   - Best practices implemented
   - Areas for improvement

   ## Related Features
   - Links to connected feature docs
   - References to CONTEXT.md sections

   ## Usage Examples
   - Common use cases with code
   - Client-side integration examples

5. **After creating the doc:**
   - Update /docs/FEATURE_INDEX.md with the new feature status
   - Note any features that should be documented together

**Output:** Create or update `/docs/features/[FEATURE_NAME].md`
```

---

## Feature Groupings

When documenting features, group related functionality together:

### Auth & Security (→ AUTH.md)

Documents together:

- Authentication endpoints (register, login, OAuth)
- Auth middleware (JWT verification)
- Auth schemas (validation)
- Session management
- Password utilities

### User Profile (→ AUTH.md or FEATURE_INDEX)

Documents together (or reference from index):

- GET/PATCH/PUT /api/users/profile and /api/user/profile
- Response shape: `data.user` with id, email, name, nickname, supabaseId, createdAt, updatedAt
- Flutter app contract alignment (see FEATURE_INDEX.md)

### Coach Dashboard (→ COACH.md)

Documents together:

- Class roster (list, remove clients; clients subscribe via /api/user/coaches)
- Client list with filters
- Performance reports
- Program assignment
- requireCoach middleware

### Data Layer (→ [MODEL_NAME].md)

Documents together:

- Prisma model definition
- CRUD controller functions
- Related schemas
- Database relationships

### Core Infrastructure

**Already in CONTEXT.md:**

- Server setup (`/src/index.ts`)
- Routing patterns (`/src/routes/`)
- Controller patterns (`/src/controllers/`)
- Middleware patterns (`/src/middleware/`)
- Validation middleware (`validate.middleware.ts`)
- Logger utility (`/src/utils/logger.ts`)
- Response builder (`/src/utils/response.ts`) — use `{ data, errors }` envelope
- File naming conventions
- Error handling patterns
- Environment variables

**API contract (FEATURE_INDEX.md):**

- All responses: `{ data, errors }`; 404/500 use same envelope
- Flutter-aligned paths: `/api/users/profile`, POST `/api/auth/refresh` (body), POST `/api/auth/logout`

**Separate docs only for:**

- Complex integrations (e.g., Supabase, Google OAuth specifics)
- Domain-specific features (e.g., Workouts, Progress Tracking)

---

## Example: Documenting a New Domain Feature

```
I need you to document the Workout Management feature for my Express server.

**Feature Category:** Domain Feature

**Primary Files to Analyze:**
- /src/routes/workout.routes.ts
- /src/controllers/workout.controller.ts
- /src/schemas/workout.schema.ts
- /prisma/schema.prisma (Workout, Exercise models)

**Instructions:**
[... rest of the prompt template ...]
```

---

## Quick Reference: What Goes Where

| Topic                          | Location                                 |
| ------------------------------ | ---------------------------------------- |
| How to add a new endpoint      | CONTEXT.md                               |
| How to use the logger          | CONTEXT.md                               |
| How to format API responses    | CONTEXT.md                               |
| How to validate requests       | CONTEXT.md                               |
| File naming conventions        | CONTEXT.md                               |
| Auth endpoints & flows         | features/AUTH.md                         |
| Protecting routes with auth    | features/AUTH.md                         |
| User model & operations        | features/AUTH.md (or USER.md if complex) |
| User profile (GET/PATCH)       | FEATURE_INDEX.md → User Profile Endpoints |
| API response envelope / contract | FEATURE_INDEX.md → API Response Envelope |
| Supabase configuration         | features/AUTH.md                         |
| Google OAuth setup             | features/AUTH.md                         |
| Coach dashboard & class routes | features/COACH.md                        |
| [New domain feature]           | features/[FEATURE].md                    |

---

_Template version: 1.1 | February 2026_
