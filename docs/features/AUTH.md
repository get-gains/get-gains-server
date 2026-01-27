# Authentication & Security

> **Status**: ✅ Documented  
> **Last Updated**: January 27, 2026  
> **Covers**: Authentication, Auth Middleware, User Model, External Integrations (Supabase, Google OAuth)

---

## Overview

### Purpose

The Authentication & Security feature provides complete user identity management for the Get Gains application:

- **Authentication**: Register, login, and OAuth flows
- **Authorization**: JWT-based route protection via middleware
- **User Management**: User model and CRUD operations
- **External Services**: Supabase Auth and Google OAuth integration

### Scope

**This document covers:**
- User registration with email/password
- User login with email/password
- Google OAuth sign-in (new users and existing users)
- Access token refresh
- Password recovery via email
- Password reset
- **Auth Middleware** (JWT verification, route protection)
- **User Model** (Prisma schema, user operations)
- **Supabase Integration** (Auth client configuration)
- **Google OAuth Integration** (ID token verification)

**Not Included:**
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)
- Rate limiting (not yet implemented)

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | ^2.91.1 | Authentication provider & session management |
| `google-auth-library` | ^10.5.0 | Google ID token verification |
| `zod` | ^4.3.5 | Request validation |
| `@prisma/client` | ^7.2.0 | Database operations (User model) |
| `pg` | ^8.17.2 | PostgreSQL driver |

### Entry Points

| File | Description |
|------|-------------|
| `/src/routes/auth.routes.ts` | Route definitions for all auth endpoints |
| `/src/controllers/auth.controller.ts` | Business logic for auth operations |
| `/src/controllers/user.controller.ts` | User CRUD operations |
| `/src/middleware/auth.middleware.ts` | JWT token verification middleware |
| `/src/schemas/auth.schema.ts` | Auth validation schemas |
| `/src/schemas/user.schema.ts` | User validation schemas |
| `/src/config/supabase.ts` | Supabase client configuration |
| `/src/config/google.ts` | Google OAuth client configuration |
| `/src/config/database.ts` | Prisma client with PostgreSQL adapter |
| `/prisma/schema.prisma` | User model definition |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATION                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS SERVER                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        AUTH ROUTES                               │   │
│  │  /api/auth/register, /login, /google, /refresh, /reset-password │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                              │                     │
│                    ▼                              ▼                     │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐  │
│  │   VALIDATION MIDDLEWARE │      │      AUTH MIDDLEWARE            │  │
│  │   (Zod Schemas)         │      │   (authenticateSupabaseUser)    │  │
│  └─────────────────────────┘      └─────────────────────────────────┘  │
│                    │                              │                     │
│                    ▼                              ▼                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      AUTH CONTROLLER                             │   │
│  │  registerWithEmailAndPassword, loginWithEmailAndPassword,        │   │
│  │  signInWithGoogle, refreshToken, resetPassword                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                    │                              │                     │
│         ┌─────────┴─────────┐          ┌────────┴────────┐            │
│         ▼                   ▼          ▼                 ▼            │
│  ┌─────────────┐    ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  SUPABASE   │    │   GOOGLE    │  │   PRISMA    │  │   USER    │  │
│  │   CLIENT    │    │   CLIENT    │  │   CLIENT    │  │CONTROLLER │  │
│  │  (Auth)     │    │  (OAuth)    │  │    (DB)     │  │  (CRUD)   │  │
│  └─────────────┘    └─────────────┘  └─────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
         ┌─────────────────┐            ┌─────────────────┐
         │  SUPABASE AUTH  │            │   POSTGRESQL    │
         │    (External)   │            │   (Database)    │
         └─────────────────┘            └─────────────────┘
```

### Component Relationships

| Component | Depends On | Used By |
|-----------|------------|---------|
| `auth.routes.ts` | auth.controller, auth.middleware, validate.middleware | Express app |
| `auth.controller.ts` | supabase, google, prisma, user.controller | auth.routes |
| `auth.middleware.ts` | supabase | Any protected route |
| `user.controller.ts` | prisma | auth.controller, future user routes |
| `supabase.ts` | Environment variables | auth.controller, auth.middleware |
| `google.ts` | Environment variables | auth.controller |
| `database.ts` | pg, prisma | All controllers needing DB |

---

## Request Flow

### Registration Flow (`POST /api/auth/register`)

```
Client Request
    │
    ▼
┌─────────────────────┐
│  validateRequest()  │  ← Validates: email, password, name, nickname
│  (RegisterSchema)   │
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  registerWithEmailAndPassword()     │
│  1. Check existing user in Prisma   │
│  2. Create user in Supabase Auth    │
│  3. Create user record in Prisma    │
│  4. Return tokens + user data       │
└─────────────────────────────────────┘
    │
    ▼
Response: { accessToken, refreshToken, user }
```

### Login Flow (`POST /api/auth/login`)

```
Client Request
    │
    ▼
┌─────────────────────┐
│  validateRequest()  │  ← Validates: email, password
│  (LoginSchema)      │
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  loginWithEmailAndPassword()        │
│  1. Authenticate with Supabase      │
│  2. Lookup user in Prisma DB        │
│  3. Return tokens + user data       │
└─────────────────────────────────────┘
    │
    ▼
Response: { accessToken, refreshToken, user }
```

### Google Sign-In Flow (New User) (`POST /api/auth/google`)

```
Client Request (idToken from Google)
    │
    ▼
┌─────────────────────┐
│  validateRequest()  │  ← Validates: idToken
│  (GoogleSignInSchema)│
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  signInWithGoogle()                 │
│  1. Verify ID token with Google     │
│  2. Sign in with Supabase (idToken) │
│  3. Return tokens + email/supabaseId│
└─────────────────────────────────────┘
    │
    ▼
Response: { accessToken, refreshToken, user: { email, supabaseId } }
```

**Note**: This returns minimal user data. The client should call `/api/auth/google/link` to create the full user profile.

### Google Login Flow (Existing User) (`POST /api/auth/login/google`)

```
Client Request (idToken from Google)
    │
    ▼
┌─────────────────────┐
│  validateRequest()  │  ← Validates: idToken
│  (GoogleSignInSchema)│
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  signInWithGoogleWithUserData()     │
│  1. Verify ID token with Google     │
│  2. Sign in with Supabase (idToken) │
│  3. Lookup user in Prisma by        │
│     supabaseId                      │
│  4. Return tokens + full user data  │
└─────────────────────────────────────┘
    │
    ▼
Response: { accessToken, refreshToken, user }
```

### Token Refresh Flow (`GET /api/auth/refresh`)

```
Client Request (Authorization: Bearer <token>)
    │
    ▼
┌──────────────────────────┐
│  authenticateSupabaseUser│  ← Verifies token, attaches user to req
└──────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  refreshToken()                     │
│  1. Extract token from header       │
│  2. Refresh session with Supabase   │
│  3. Return new tokens               │
└─────────────────────────────────────┘
    │
    ▼
Response: { accessToken, refreshToken }
```

### Password Recovery Flow

**Step 1: Send Recovery Email (`POST /api/auth/send-recovery-email`)**

```
Client Request
    │
    ▼
┌─────────────────────┐
│  validateRequest()  │  ← Validates: email
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  sendRecoveryEmail()                │
│  1. Call Supabase resetPasswordFor  │
│     Email with redirect URL         │
│  2. Return success message          │
└─────────────────────────────────────┘
    │
    ▼
Response: { message: "Password recovery email sent successfully" }
```

**Step 2: Reset Password (`POST /api/auth/reset-password`)**

```
Client Request (Authorization: Bearer <token>)
    │
    ▼
┌──────────────────────────┐
│  authenticateSupabaseUser│  ← Verifies recovery token
└──────────────────────────┘
    │
    ▼
┌─────────────────────┐
│  validateRequest()  │  ← Validates: accessToken, newPassword
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  resetPassword()                    │
│  1. Update password via Supabase    │
│  2. Return success message          │
└─────────────────────────────────────┘
    │
    ▼
Response: { message: "Password reset successfully" }
```

---

## Implementation Details

### Controllers

#### `registerWithEmailAndPassword`

Handles new user registration with email/password.

```typescript
// Location: /src/controllers/auth.controller.ts

export const registerWithEmailAndPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  // 1. Extract validated data
  const { email, password, name, nickname }: RegisterInput = req.body;
  
  // 2. Check for existing user
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  
  // 3. Create in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
  });
  
  // 4. Create in Prisma DB
  const user = await createUser({ email, name, nickname, supabaseId });
  
  // 5. Return response
  sendSuccess(res, { accessToken, refreshToken, user }, 201);
};
```

#### `loginWithEmailAndPassword`

Authenticates existing users with email/password.

```typescript
// Location: /src/controllers/auth.controller.ts

export const loginWithEmailAndPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  // 1. Authenticate with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });
  
  // 2. Lookup user in Prisma
  const user = await prisma.user.findUnique({
    where: { supabaseId: data.user.id },
  });
  
  // 3. Return tokens + user data
  sendSuccess(res, { accessToken, refreshToken, user }, 200);
};
```

#### `signInWithGoogle` / `signInWithGoogleWithUserData`

Two Google sign-in variants:

- `signInWithGoogle` - For new users (returns minimal data)
- `signInWithGoogleWithUserData` - For existing users (returns full user data)

```typescript
// Location: /src/controllers/auth.controller.ts

// Both follow this pattern:
// 1. Verify Google ID token
const ticket = await googleClient.verifyIdToken({
  idToken,
  audience: process.env.GOOGLE_CLIENT_ID,
});

// 2. Sign in with Supabase using the ID token
const { data } = await supabase.auth.signInWithIdToken({
  provider: 'google',
  token: idToken,
});

// 3. (For existing users) Lookup in Prisma
const userData = await getUserBySupabaseId(supabaseData.user.id);
```

---

## Auth Middleware (Route Protection)

The auth middleware provides JWT-based route protection using Supabase tokens.

### `authenticateSupabaseUser`

**Location:** `/src/middleware/auth.middleware.ts`

This middleware:
1. Extracts Bearer token from the `Authorization` header
2. Verifies the token with Supabase
3. Attaches the authenticated user to `req.user`
4. Blocks unauthorized requests with 401 response

```typescript
// Full implementation
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendSingleError, sendSuccess } from '../utils/response';
import type { UserModel } from '../generated/prisma/models/User';
import supabase from '../config/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: SupabaseUser | UserModel;
    }
  }
}

export const authenticateSupabaseUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      sendSuccess(res, { error: 'No token provided' }, 401);
      return;
    }

    // 2. Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      sendSingleError(res, 'Invalid or expired token', 401);
      return;
    }

    // 3. Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    sendSingleError(res, 'Authentication failed', 500);
    return;
  }
};
```

### Request Type Extension

The middleware extends the Express `Request` interface to include the user:

```typescript
// Available types for req.user
type SupabaseUser = {
  id: string;           // Supabase user ID (UUID)
  email?: string;
  // ... other Supabase user properties
};

type UserModel = {
  id: string;           // Prisma user ID (cuid)
  supabaseId: string;
  email: string;
  name: string;
  nickname: string;
  createdAt: Date;
  updatedAt: Date;
};
```

### Usage Examples

#### Basic Protected Route

```typescript
import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';

const router = Router();

// This route requires authentication
router.get('/profile', authenticateSupabaseUser, async (req, res) => {
  // req.user is the Supabase user
  const supabaseId = req.user!.id;
  
  // Fetch full user data from Prisma if needed
  const user = await prisma.user.findUnique({
    where: { supabaseId }
  });
  
  sendSuccess(res, { user });
});
```

#### Multiple Middleware Chain

```typescript
router.post(
  '/update-profile',
  authenticateSupabaseUser,           // 1. Verify auth
  validateRequest(UpdateProfileSchema), // 2. Validate body
  updateProfileController              // 3. Handle request
);
```

### Auth Flow Diagram

```
Request with "Authorization: Bearer <token>"
    │
    ▼
┌─────────────────────────────────────┐
│     authenticateSupabaseUser()      │
│                                     │
│  1. Check Authorization header      │
│     ├── Missing → 401 "No token"    │
│     └── Present → Extract token     │
│                                     │
│  2. Verify token with Supabase      │
│     ├── Invalid → 401 "Invalid"     │
│     └── Valid → Continue            │
│                                     │
│  3. Attach user to req.user         │
│                                     │
│  4. Call next()                     │
└─────────────────────────────────────┘
    │
    ▼
  Controller (req.user available)
```

---

## User Model & Operations

### Prisma Schema

**Location:** `/prisma/schema.prisma`

```prisma
model User {
  id         String   @id @default(cuid())
  supabaseId String   @unique
  email      String   @unique
  name       String
  nickname   String
  createdAt  DateTime @default(now()) @db.Timestamptz
  updatedAt  DateTime @updatedAt @db.Timestamptz
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key for internal use |
| `supabaseId` | String | Links to Supabase Auth user (unique) |
| `email` | String | User's email address (unique, lowercase) |
| `name` | String | User's display name |
| `nickname` | String | User's nickname/username |
| `createdAt` | DateTime | Account creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### User Controller

**Location:** `/src/controllers/user.controller.ts`

#### `createUser`

Creates a new user record in the database.

```typescript
import prisma from '../config/database';
import { CreateUserData } from '../schemas/user.schema';

export const createUser = async (data: CreateUserData) => {
  const { email, name, nickname, supabaseId } = data;
  
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      nickname,
      supabaseId,
    },
  });

  return user;
};
```

#### `getUserBySupabaseId`

Retrieves a user by their Supabase ID.

```typescript
export const getUserBySupabaseId = async (supabaseId: string) => {
  return await prisma.user.findUnique({
    where: { supabaseId },
  });
};
```

### User Schemas

**Location:** `/src/schemas/user.schema.ts`

```typescript
import { z } from 'zod';

export const CreateUserSchema = z.object({
  body: z.object({
    email: z.email(),
    name: z.string().min(1).max(100),
    nickname: z.string().min(1).max(50),
    supabaseId: z.string().min(1),
  }),
});

export type CreateUserData = z.infer<typeof CreateUserSchema>['body'];
```

---

## External Service Integrations

### Supabase Configuration

**Location:** `/src/config/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default supabase;
```

**Key Points:**
- Uses service role key (not anon key) for server-side operations
- Service role bypasses Row Level Security (RLS)
- Never expose service role key to clients

**Supabase Auth Methods Used:**

| Method | Purpose |
|--------|---------|
| `supabase.auth.signUp()` | Register new user |
| `supabase.auth.signInWithPassword()` | Email/password login |
| `supabase.auth.signInWithIdToken()` | Google OAuth login |
| `supabase.auth.getUser()` | Verify JWT and get user |
| `supabase.auth.refreshSession()` | Refresh access token |
| `supabase.auth.resetPasswordForEmail()` | Send recovery email |
| `supabase.auth.updateUser()` | Update user (password reset) |

### Google OAuth Configuration

**Location:** `/src/config/google.ts`

```typescript
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default googleClient;
```

**Usage in Auth Controller:**

```typescript
// Verify Google ID token
const ticket = await googleClient.verifyIdToken({
  idToken,                              // Token from Google Sign-In
  audience: process.env.GOOGLE_CLIENT_ID, // Must match your client ID
});

const payload = ticket.getPayload();
// payload.email, payload.name, payload.sub (Google user ID)
```

### Database Configuration

**Location:** `/src/config/database.ts`

```typescript
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Create PostgreSQL connection pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter for PostgreSQL
const adapter = new PrismaPg(pool);

// Singleton Prisma client instance
const prisma = new PrismaClient({ adapter });

export default prisma;
```

---

### Validation Schemas

All schemas are defined in `/src/schemas/auth.schema.ts`:

| Schema | Fields | Validation Rules |
|--------|--------|------------------|
| `RegisterSchema` | email, password, name, nickname | Email format, password 8-100 chars with uppercase + special char |
| `LoginSchema` | email, password | Email format, password required |
| `GoogleSignInSchema` | idToken | String, required |
| `SendRecoveryEmailSchema` | email | Email format |
| `ResetPasswordSchema` | accessToken, newPassword | Token required, password 8-100 chars with uppercase + special char |

**Password Validation Rules:**
```typescript
password: z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .refine(password => /[A-Z]/.test(password), 'Must contain 1 capital letter')
  .refine(password => /[!@#$%^&*()...]/.test(password), 'Must contain 1 special character')
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes (for Google auth) |
| `FLUTTER_RESET_PASSWORD_PAGE` | Redirect URL for password reset emails | Yes |

### Supabase Setup

The Supabase client is initialized with the service role key for server-side operations:

```typescript
// /src/config/supabase.ts
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);
```

### Google OAuth Setup

```typescript
// /src/config/google.ts
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
```

---

## API Reference

### `POST /api/auth/register`

Register a new user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1!",
  "name": "John Doe",
  "nickname": "johnd"
}
```

**Success Response (201):**
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.refresh...",
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "John Doe",
      "nickname": "johnd",
      "supabaseId": "uuid..."
    }
  },
  "errors": []
}
```

**Error Response (409):**
```json
{
  "data": null,
  "errors": [{ "field": "email", "message": "Email already exists" }]
}
```

---

### `POST /api/auth/login`

Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1!"
}
```

**Success Response (200):**
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.refresh...",
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "John Doe",
      "nickname": "johnd",
      "supabaseId": "uuid..."
    }
  },
  "errors": []
}
```

**Error Response (401):**
```json
{
  "data": null,
  "errors": [{ "message": "Invalid email or password" }]
}
```

---

### `POST /api/auth/google`

Sign in with Google (for new users).

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Success Response (200):**
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.refresh...",
    "user": {
      "email": "user@gmail.com",
      "supabaseId": "uuid..."
    }
  },
  "errors": []
}
```

---

### `POST /api/auth/google/link`

Link Google account by creating a user profile (requires auth).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "email": "user@gmail.com",
  "name": "John Doe",
  "nickname": "johnd",
  "supabaseId": "uuid..."
}
```

---

### `POST /api/auth/login/google`

Login with Google (for existing users).

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Success Response (200):** Same as `/api/auth/login`

**Error Response (404):**
```json
{
  "data": null,
  "errors": [{ "message": "User not found" }]
}
```

---

### `GET /api/auth/refresh`

Refresh access token.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Success Response (200):**
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.refresh..."
  },
  "errors": []
}
```

---

### `POST /api/auth/send-recovery-email`

Send password recovery email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "data": {
    "message": "Password recovery email sent successfully"
  },
  "errors": []
}
```

---

### `POST /api/auth/reset-password`

Reset password (requires auth with recovery token).

**Headers:**
```
Authorization: Bearer <recoveryToken>
```

**Request:**
```json
{
  "accessToken": "recovery-token...",
  "newPassword": "NewSecurePass1!"
}
```

**Success Response (200):**
```json
{
  "data": {
    "message": "Password reset successfully"
  },
  "errors": []
}
```

---

## Error Handling

### Error Codes

| Status | Scenario |
|--------|----------|
| 400 | Invalid request body (validation failed) |
| 401 | Invalid credentials, expired token, no token provided |
| 404 | User not found in database |
| 409 | Email already exists (registration) |
| 500 | Internal server error (Supabase failure, DB error) |

### Error Response Format

All errors follow the standard API response format:

```json
{
  "data": null,
  "errors": [
    { "field": "email", "message": "Invalid email address" },
    { "message": "Generic error without field" }
  ]
}
```

### Logging

All auth operations are logged using the application logger:

```typescript
logger.debug('Registration attempt', { email });
logger.error('Supabase user creation failed', { email, error: supabaseError });
```

---

## Security Considerations

### Password Requirements

- Minimum 8 characters
- Maximum 100 characters
- At least 1 uppercase letter
- At least 1 special character

### Token Storage

- Access tokens are short-lived JWTs from Supabase
- Refresh tokens allow obtaining new access tokens
- Server uses service role key (never exposed to client)

### Best Practices Implemented

- ✅ Passwords hashed by Supabase (not stored in plain text)
- ✅ Email normalized to lowercase
- ✅ Input validation on all endpoints
- ✅ Google ID tokens verified server-side
- ✅ Errors logged without exposing sensitive data

### Areas for Improvement

- ⚠️ Rate limiting not implemented
- ⚠️ Account lockout after failed attempts not implemented
- ⚠️ Audit logging not implemented

---

## Related Documentation

| Topic | Location | Description |
|-------|----------|-------------|
| Validation Middleware | [CONTEXT.md](../CONTEXT.md#middleware) | `validateRequest()` middleware pattern |
| Response Builder | [CONTEXT.md](../CONTEXT.md#responsets---use-this-for-all-api-responses) | `sendSuccess`, `sendError` utilities |
| Logger | [CONTEXT.md](../CONTEXT.md#loggerts---use-this-for-all-logging) | Logging utility usage |
| File Conventions | [CONTEXT.md](../CONTEXT.md#conventions) | Naming and import conventions |
| Adding New Routes | [CONTEXT.md](../CONTEXT.md#adding-a-new-resource) | How to add new endpoints |

**Note:** Auth Middleware, User Model, Supabase, and Google OAuth are all documented in this file (AUTH.md) since they're tightly coupled to authentication.

---

## Usage Examples

### Protecting a Route

```typescript
import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';

const router = Router();

router.get('/profile', authenticateSupabaseUser, async (req, res) => {
  // req.user contains the authenticated Supabase user
  const supabaseId = req.user!.id;
  // ... fetch user data
});
```

### Client-Side Registration Flow

```typescript
// 1. Register
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass1!',
    name: 'John Doe',
    nickname: 'johnd'
  })
});

const { data } = await response.json();
// Store data.accessToken and data.refreshToken
```

### Client-Side Google Sign-In Flow (New User)

```typescript
// 1. Get ID token from Google Sign-In
const idToken = await getGoogleIdToken();

// 2. Sign in with server (creates Supabase account)
const signInResponse = await fetch('/api/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken })
});

const { data: signInData } = await signInResponse.json();

// 3. Create user profile
const linkResponse = await fetch('/api/auth/google/link', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${signInData.accessToken}`
  },
  body: JSON.stringify({
    email: signInData.user.email,
    name: 'John Doe',
    nickname: 'johnd',
    supabaseId: signInData.user.supabaseId
  })
});
```

---

*Documentation generated from codebase analysis on January 27, 2026*
