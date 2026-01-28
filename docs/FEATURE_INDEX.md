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

### Future Domain Features *(Needs Documentation)*

Features to document when implemented:

| Feature | Description | Status | Location |
|---------|-------------|--------|----------|
| Workouts | Workout/exercise management | 🔮 Not Implemented | - |
| Progress Tracking | User progress and stats | 🔮 Not Implemented | - |
| User Settings | Preferences and profile | 🔮 Not Implemented | - |

---

## API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/` | Hello message | No |
| `GET` | `/health` | Health check | No |
| `POST` | `/api/auth/register` | Register with email/password | No |
| `POST` | `/api/auth/login` | Login with email/password | No |
| `POST` | `/api/auth/google` | Sign in with Google (new user flow) | No |
| `POST` | `/api/auth/google/link` | Link Google account to existing user | Yes |
| `POST` | `/api/auth/login/google` | Login with Google (existing user) | No |
| `GET` | `/api/auth/refresh` | Refresh access token | Yes |
| `POST` | `/api/auth/send-recovery-email` | Send password recovery email | No |
| `POST` | `/api/auth/reset-password` | Reset password | Yes |

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

*Last updated: January 27, 2026*
