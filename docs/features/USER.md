# User Profile Feature

> **Status**: ✅ Documented  
> **Last Updated**: February 14, 2026  
> **Covers**: User Profile GET/PATCH/PUT endpoints (Flutter contract)

---

## Overview

### Purpose

The User Profile feature provides backend APIs for managing user profiles. This feature is designed to meet the **Flutter app API contract**, supporting:

- **Profile Retrieval**: Get current authenticated user's profile data
- **Profile Updates**: Update user name and nickname
- **Dual Endpoint Support**: Both `/api/user/profile` and `/api/users/profile` paths
- **Multiple HTTP Methods**: GET, PATCH, and PUT support for compatibility

All responses follow the **API Response Envelope** pattern (`{ data, errors }`) as specified in the Flutter contract.

### Scope

**This document covers:**

- GET /api/user/profile and /api/users/profile (retrieve profile)
- PATCH /api/user/profile and /api/users/profile (update profile)
- PUT /api/user/profile and /api/users/profile (update profile, same as PATCH)
- Profile data structure
- Authentication requirements
- Error handling

**Not Included:**

- User registration (see [AUTH.md](AUTH.md))
- Password management (see [AUTH.md](AUTH.md))
- Coach profile creation (see [COACH.md](COACH.md))
- Client coach selection (see [COACH.md](COACH.md))

### Dependencies

| Package          | Version | Purpose             |
| ---------------- | ------- | ------------------- |
| `@prisma/client` | ^7.2.0  | Database operations |
| `zod`            | ^4.3.5  | Request validation  |
| `express`        | ^5.2.1  | HTTP routing        |

### Entry Points

| File                                  | Description                       |
| ------------------------------------- | --------------------------------- |
| `/src/routes/user.routes.ts`          | User profile route definitions    |
| `/src/controllers/user.controller.ts` | Profile business logic            |
| `/src/schemas/user.schema.ts`         | Profile validation schemas        |
| `/src/middleware/auth.middleware.ts`  | Authentication middleware         |
| `/prisma/schema.prisma`               | User model definition             |

---

## Architecture

### Request Flow (Profile Endpoints)

```
Request with Authorization: Bearer <token>
    │
    ▼
┌─────────────────────────────────────┐
│   authenticateSupabaseUser          │  Verifies Supabase JWT
│                                     │  Attaches user to req.user
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│       requireAppUser                │  Looks up User by supabaseId
│                                     │  Attaches to req.appUser
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│   validateRequest (PATCH/PUT only)  │  Validates body schema
└─────────────────────────────────────┘
    │
    ▼
  Controller (req.appUser available)
```

### Component Relationships

```
┌─────────────────────────────────────────────┐
│          user.routes.ts                     │
│  - GET    /profile                          │
│  - PATCH  /profile                          │
│  - PUT    /profile                          │
└─────────────────────────────────────────────┘
              │
              │ uses
              ▼
┌─────────────────────────────────────────────┐
│       user.controller.ts                    │
│  - getProfile()                             │
│  - updateProfile()                          │
└─────────────────────────────────────────────┘
              │
              │ validates with
              ▼
┌─────────────────────────────────────────────┐
│       user.schema.ts                        │
│  - UpdateProfileSchema                      │
└─────────────────────────────────────────────┘
              │
              │ queries
              ▼
┌─────────────────────────────────────────────┐
│         Prisma User Model                   │
│  - id, email, name, nickname                │
│  - supabaseId, createdAt, updatedAt         │
└─────────────────────────────────────────────┘
```

---

## Implementation Details

### Routes Definition

**Location:** `/src/routes/user.routes.ts`

```typescript
import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { UpdateProfileSchema } from '../schemas/user.schema';
import {
  getProfile,
  updateProfile,
} from '../controllers/user.controller';

const router = Router();

/**
 * @route   GET /user/profile or /users/profile
 * @desc    Current user profile (Flutter app contract)
 * @access  Protected
 */
router.get('/profile', authenticateSupabaseUser, requireAppUser, getProfile);

/**
 * @route   PATCH /user/profile or /users/profile
 * @desc    Update current user profile
 * @access  Protected
 */
router.patch(
  '/profile',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateProfileSchema),
  updateProfile
);

/**
 * @route   PUT /user/profile or /users/profile
 * @desc    Update current user profile (same as PATCH)
 * @access  Protected
 */
router.put(
  '/profile',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(UpdateProfileSchema),
  updateProfile
);

export default router;
```

**Key Points:**

- All routes require authentication (`authenticateSupabaseUser` + `requireAppUser`)
- PATCH and PUT both map to `updateProfile` controller for compatibility
- Mounted on both `/api/user` and `/api/users` in `index.ts` for Flutter compatibility

### Controllers

**Location:** `/src/controllers/user.controller.ts`

#### getProfile

Retrieves the authenticated user's profile data.

```typescript
export const getProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: appUser.id },
    });

    if (!user) {
      sendSingleError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        supabaseId: user.supabaseId,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch profile', 500);
  }
};
```

**Behavior:**

- Requires authenticated user (`req.appUser` set by `requireAppUser`)
- Fetches user from database by ID
- Returns 404 if user doesn't exist (edge case)
- Returns user profile in `data.user` field (Flutter contract)
- Logs errors and returns 500 on database failure

#### updateProfile

Updates the authenticated user's name and/or nickname.

```typescript
export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const appUser = req.appUser;
    if (!appUser) {
      sendSingleError(res, 'Authentication required', 401);
      return;
    }

    const body = req.body as UpdateProfileInput;
    const data: { name?: string; nickname?: string } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.nickname !== undefined) data.nickname = body.nickname;

    // If no fields to update, return current profile
    if (Object.keys(data).length === 0) {
      const user = await prisma.user.findUnique({
        where: { id: appUser.id },
      });
      if (!user) {
        sendSingleError(res, 'User not found', 404);
        return;
      }
      sendSuccess(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          supabaseId: user.supabaseId,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: appUser.id },
      data,
    });

    sendSuccess(res, {
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        nickname: updated.nickname,
        supabaseId: updated.supabaseId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Error updating profile', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to update profile', 500);
  }
};
```

**Behavior:**

- Requires authenticated user (`req.appUser`)
- Accepts partial updates (name and/or nickname)
- If no fields provided, returns current profile unchanged
- Updates only provided fields using Prisma's partial update
- Returns updated profile in `data.user` field
- Logs errors and returns 500 on database failure

### Validation Schemas

**Location:** `/src/schemas/user.schema.ts`

```typescript
import { z } from 'zod';

/**
 * Schema for updating user profile (Flutter app contract: PATCH /users/profile)
 */
export const UpdateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      nickname: z.string().min(1).max(50).optional(),
    })
    .strict(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>['body'];
```

**Validation Rules:**

- `name`: Optional string, 1-100 characters
- `nickname`: Optional string, 1-50 characters
- Schema is strict: no additional fields allowed
- Both fields are optional (partial updates supported)

### Middleware

**Location:** `/src/middleware/auth.middleware.ts`

#### authenticateSupabaseUser

Verifies the JWT Bearer token and attaches Supabase user to `req.user`.

```typescript
req.user = {
  id: string;        // Supabase user ID
  email: string;
  // ... other Supabase user fields
}
```

#### requireAppUser

Looks up the application User record by `supabaseId` and attaches to `req.appUser`.

```typescript
req.appUser = {
  id: string;        // Application user ID (Prisma)
  email: string;
  name: string;
  nickname: string;
  supabaseId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Error Handling:**

- Returns 401 if user not found in database
- Returns 500 on database errors

---

## API Reference

### Endpoints Summary

| Method  | Endpoint                | Description                    | Auth Required |
| ------- | ----------------------- | ------------------------------ | ------------- |
| `GET`   | `/api/users/profile`    | Get current user profile       | Yes           |
| `GET`   | `/api/user/profile`     | Same as above (alias)          | Yes           |
| `PATCH` | `/api/users/profile`    | Update name and/or nickname    | Yes           |
| `PUT`   | `/api/users/profile`    | Same as PATCH (compatibility)  | Yes           |
| `PATCH` | `/api/user/profile`     | Same as PATCH (alias)          | Yes           |
| `PUT`   | `/api/user/profile`     | Same as PUT (alias)            | Yes           |

### GET /api/users/profile

**Description:** Retrieve the authenticated user's profile.

**Authentication:** Required (Bearer token)

**Request:**

```http
GET /api/users/profile HTTP/1.1
Authorization: Bearer <supabase_jwt_token>
```

**Success Response (200):**

```json
{
  "data": {
    "user": {
      "id": "clxxx123456789",
      "email": "user@example.com",
      "name": "John Doe",
      "nickname": "Johnny",
      "supabaseId": "supabase-user-id-123",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-14T14:20:00.000Z"
    }
  },
  "errors": []
}
```

**Error Responses:**

```json
// 401 Unauthorized - Missing or invalid token
{
  "data": null,
  "errors": [{ "message": "Authentication required" }]
}

// 404 Not Found - User doesn't exist
{
  "data": null,
  "errors": [{ "message": "User not found" }]
}

// 500 Internal Server Error
{
  "data": null,
  "errors": [{ "message": "Failed to fetch profile" }]
}
```

### PATCH /api/users/profile

**Description:** Update user name and/or nickname. Supports partial updates.

**Authentication:** Required (Bearer token)

**Request:**

```http
PATCH /api/users/profile HTTP/1.1
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json

{
  "name": "John Smith",
  "nickname": "JS"
}
```

**Body Parameters:**

| Field      | Type   | Required | Description                        |
| ---------- | ------ | -------- | ---------------------------------- |
| `name`     | string | No       | User's full name (1-100 chars)     |
| `nickname` | string | No       | User's nickname/display name (1-50)|

**Success Response (200):**

```json
{
  "data": {
    "user": {
      "id": "clxxx123456789",
      "email": "user@example.com",
      "name": "John Smith",
      "nickname": "JS",
      "supabaseId": "supabase-user-id-123",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-02-14T14:25:00.000Z"
    }
  },
  "errors": []
}
```

**Error Responses:**

```json
// 400 Bad Request - Validation error
{
  "data": null,
  "errors": [
    { "field": "body.name", "message": "String must contain at least 1 character(s)" },
    { "field": "body.nickname", "message": "String must contain at most 50 character(s)" }
  ]
}

// 401 Unauthorized
{
  "data": null,
  "errors": [{ "message": "Authentication required" }]
}

// 404 Not Found
{
  "data": null,
  "errors": [{ "message": "User not found" }]
}

// 500 Internal Server Error
{
  "data": null,
  "errors": [{ "message": "Failed to update profile" }]
}
```

### PUT /api/users/profile

**Description:** Same as PATCH. Provided for HTTP method compatibility.

**Request/Response:** Identical to PATCH endpoint above.

---

## Configuration

No environment variables are specific to the User Profile feature. It relies on standard database and authentication configuration documented in [CONTEXT.md](../CONTEXT.md).

---

## Error Handling

### Error Codes

| Status Code | Error Message              | Cause                                    |
| ----------- | -------------------------- | ---------------------------------------- |
| 400         | Validation errors          | Invalid name or nickname format          |
| 401         | Authentication required    | Missing or invalid Bearer token          |
| 404         | User not found             | User doesn't exist in database           |
| 500         | Failed to fetch profile    | Database error during retrieval          |
| 500         | Failed to update profile   | Database error during update             |

### Error Response Structure

All errors follow the API Response Envelope pattern:

```json
{
  "data": null,
  "errors": [
    {
      "field": "body.name",        // Optional: field that caused error
      "message": "Error description"
    }
  ]
}
```

### Common Error Scenarios

#### 1. Invalid Token

**Scenario:** Expired or malformed JWT token

**Response:**
```json
{
  "data": null,
  "errors": [{ "message": "Authentication required" }]
}
```

**Resolution:** Client should refresh token or re-authenticate.

#### 2. Validation Failure

**Scenario:** Name too long, nickname empty, or extra fields provided

**Response:**
```json
{
  "data": null,
  "errors": [
    { "field": "body.name", "message": "String must contain at most 100 character(s)" }
  ]
}
```

**Resolution:** Client should correct input and retry.

#### 3. Database Connection Error

**Scenario:** Database unavailable or timeout

**Response:**
```json
{
  "data": null,
  "errors": [{ "message": "Failed to fetch profile" }]
}
```

**Resolution:** Automatic retry with exponential backoff recommended.

---

## Security

### Authentication Requirements

- All profile endpoints require valid Supabase JWT token
- Token must be sent as `Authorization: Bearer <token>` header
- Token is verified by `authenticateSupabaseUser` middleware
- User must exist in application database (verified by `requireAppUser`)

### Authorization

- Users can only access their own profile
- User ID is derived from authenticated token (not URL parameter)
- No admin or super-user access required for basic profile operations

### Data Validation

- Strict schema validation prevents additional fields
- Length limits prevent buffer overflow attacks
- Email is read-only (not updatable via profile endpoints)
- supabaseId is read-only (managed by auth system)

### Best Practices

1. **Token Security:** Never log or expose JWT tokens
2. **Input Sanitization:** All inputs validated by Zod before processing
3. **Error Messages:** Generic errors prevent information leakage
4. **Database Security:** Prisma parameterized queries prevent SQL injection

---

## Related Documentation

- [CONTEXT.md](../CONTEXT.md) - Core patterns and conventions
- [FEATURE_INDEX.md](../FEATURE_INDEX.md) - Feature navigation
- [features/AUTH.md](AUTH.md) - Authentication and user registration
- [features/COACH.md](COACH.md) - Coach profile creation and client selection
- `/src/middleware/auth.middleware.ts` - Authentication middleware details

---

## Usage Examples

### Flutter Client Example

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class ProfileService {
  final String baseUrl;
  final String token;

  ProfileService(this.baseUrl, this.token);

  // Get current user profile
  Future<Map<String, dynamic>> getProfile() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/users/profile'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    final body = json.decode(response.body);
    
    if (response.statusCode == 200 && body['errors'].isEmpty) {
      return body['data']['user'];
    } else {
      throw Exception(body['errors'][0]['message']);
    }
  }

  // Update profile
  Future<Map<String, dynamic>> updateProfile({
    String? name,
    String? nickname,
  }) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (nickname != null) body['nickname'] = nickname;

    final response = await http.patch(
      Uri.parse('$baseUrl/api/users/profile'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode(body),
    );

    final responseBody = json.decode(response.body);
    
    if (response.statusCode == 200 && responseBody['errors'].isEmpty) {
      return responseBody['data']['user'];
    } else {
      throw Exception(responseBody['errors'][0]['message']);
    }
  }
}
```

### JavaScript/TypeScript Client Example

```typescript
interface ApiResponse<T> {
  data: T | null;
  errors: Array<{ field?: string; message: string }>;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  nickname: string;
  supabaseId: string;
  createdAt: string;
  updatedAt: string;
}

class ProfileAPI {
  constructor(
    private baseUrl: string,
    private token: string
  ) {}

  async getProfile(): Promise<UserProfile> {
    const response = await fetch(`${this.baseUrl}/api/users/profile`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    const body: ApiResponse<{ user: UserProfile }> = await response.json();

    if (!response.ok || body.errors.length > 0) {
      throw new Error(body.errors[0]?.message || 'Failed to fetch profile');
    }

    return body.data!.user;
  }

  async updateProfile(updates: {
    name?: string;
    nickname?: string;
  }): Promise<UserProfile> {
    const response = await fetch(`${this.baseUrl}/api/users/profile`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const body: ApiResponse<{ user: UserProfile }> = await response.json();

    if (!response.ok || body.errors.length > 0) {
      throw new Error(body.errors[0]?.message || 'Failed to update profile');
    }

    return body.data!.user;
  }
}

// Usage
const api = new ProfileAPI('http://localhost:3000', 'your-jwt-token');

// Get profile
const profile = await api.getProfile();
console.log(profile.name, profile.nickname);

// Update profile
const updated = await api.updateProfile({
  name: 'New Name',
  nickname: 'NewNick'
});
console.log('Updated:', updated);
```

### cURL Examples

```bash
# Get profile
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Update profile (partial)
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith"
  }'

# Update profile (both fields)
curl -X PATCH http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "nickname": "JS"
  }'

# Using PUT instead of PATCH (same behavior)
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "Johnny"
  }'
```

---

_Last updated: February 14, 2026_
