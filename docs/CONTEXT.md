# Get Gains Server - Agent Context

> **Purpose**: This document provides coding agents with the structural context needed to contribute to this Express.js TypeScript server.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Validation**: Zod v4

---

## Project Structure

```
src/
├── index.ts              # Express app entry point
├── controllers/          # Business logic handlers
│   └── *.controller.ts
├── routes/               # Route definitions
│   └── *.routes.ts
├── middleware/           # Custom middleware
│   └── *.middleware.ts
├── schemas/              # Zod validation schemas
│   └── *.schema.ts
└── utils/                # Utility functions
    ├── logger.ts         # Logging utility (USE THIS)
    ├── response.ts       # API response builder (USE THIS)
    └── console-message.ts
```

---

## Folder Responsibilities

### `/controllers`

Controllers contain the business logic for handling requests. They:

- Receive validated request data from routes
- Perform business operations
- Return appropriate responses

**Naming**: `<resource>.controller.ts`

```typescript
// Example: user.controller.ts
import { Request, Response } from "express";
import { logger } from "../utils/logger";

export const getUser = async (req: Request, res: Response) => {
  logger.debug("Fetching user", { id: req.params.id });
  // Business logic here
};
```

### `/routes`

Routes define API endpoints and wire up middleware + controllers. They:

- Define HTTP method and path
- Apply relevant middleware (validation, auth, etc.)
- Call controller functions

**Naming**: `<resource>.routes.ts`

```typescript
// Example: user.routes.ts
import { Router } from "express";
import { getUser } from "../controllers/user.controller";
import { validateRequest } from "../middleware/validate.middleware";
import { GetUserSchema } from "../schemas/user.schema";

const router = Router();

router.get("/:id", validateRequest(GetUserSchema), getUser);

export default router;
```

### `/middleware`

Middleware functions for request processing pipeline. They:

- Run before controllers
- Can modify req/res objects
- Handle cross-cutting concerns (auth, validation, logging)

**Naming**: `<purpose>.middleware.ts`

```typescript
// Example: auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.debug("Authenticating request");
  // Auth logic here
  next();
};
```

### `/schemas`

Zod schemas for request/response validation. They:

- Define data shapes using Zod v4
- Export TypeScript types inferred from schemas
- Are used by validation middleware

**Naming**: `<resource>.schema.ts`

```typescript
// Example: user.schema.ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8),
    name: z.string().min(1),
  }),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>["body"];
```

### `/utils`

Shared utility functions. Current utilities:

#### `logger.ts` - **USE THIS FOR ALL LOGGING**

```typescript
import { logger } from "../utils/logger";

logger.debug("Debug message", { context: "optional" });
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message", error);
```

**Log Levels** (controlled via `LOG_LEVEL` env var):

- `DEBUG` - Verbose debugging info
- `INFO` - General operational info
- `WARN` - Warning conditions
- `ERROR` - Error conditions (auto-prints stack traces)

#### `console-message.ts`

HTTP request logging utility for path/method/status display.

#### `response.ts` - **USE THIS FOR ALL API RESPONSES**

Consistent API response builder. All responses follow this structure:

```typescript
interface ApiResponse<T = null> {
  data: T;
  errors: ApiError[];
}

interface ApiError {
  field?: string;
  message: string;
}
```

**Usage:**

```typescript
import { sendSuccess, sendError, sendSingleError } from "../utils/response";

// Success response with data
sendSuccess(res, { user: { id: "123", name: "John" } }); // 200 by default
sendSuccess(res, { user: newUser }, 201); // Custom status code

// Error response with multiple errors (e.g., validation)
sendError(
  res,
  [
    { field: "email", message: "Invalid email" },
    { field: "password", message: "Too short" },
  ],
  400,
);

// Single error response
sendSingleError(res, "User not found", 404);
sendSingleError(res, "Email already exists", 409, "email");
```

**Response Examples:**

```json
// Success: GET /users/123
{
  "data": {
    "user": {
      "id": "123",
      "email": "user@example.com",
      "name": "John"
    }
  },
  "errors": []
}

// Validation Error: POST /users (invalid body)
{
  "data": null,
  "errors": [
    { "field": "body.email", "message": "Invalid email address" },
    { "field": "body.password", "message": "Password must be at least 8 characters" }
  ]
}

// Single Error: GET /users/999
{
  "data": null,
  "errors": [
    { "message": "User not found" }
  ]
}
```

---

## Conventions

### File Naming

- Controllers: `<resource>.controller.ts`
- Routes: `<resource>.routes.ts`
- Middleware: `<purpose>.middleware.ts`
- Schemas: `<resource>.schema.ts`

### Imports

```typescript
// External
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

// Internal - always use relative paths
import { logger } from "../utils/logger";
import { sendSuccess, sendError, sendSingleError } from "../utils/response";
import { SomeSchema } from "../schemas/some.schema";
```

### Error Handling

Always use the logger for errors and the response utility for consistent responses:

```typescript
import { logger } from "../utils/logger";
import { sendSuccess, sendSingleError } from "../utils/response";

try {
  const result = await someOperation();
  sendSuccess(res, { result });
} catch (error) {
  logger.error("Operation failed", error);
  sendSingleError(res, "Internal server error", 500);
}
```

### Request Validation Pattern

1. Define schema in `/schemas`
2. Use `validateRequest` middleware in routes
3. Access validated data in controller via `req.body`, `req.params`, `req.query`

---

## Adding a New Resource

1. **Create schema**: `src/schemas/<resource>.schema.ts`
2. **Create controller**: `src/controllers/<resource>.controller.ts`
3. **Create routes**: `src/routes/<resource>.routes.ts`
4. **Register routes** in `src/index.ts`:
   ```typescript
   import resourceRoutes from "./routes/<resource>.routes";
   app.use("/api/<resource>", resourceRoutes);
   ```

---

## Environment Variables

| Variable               | Description                               | Default                     |
| ---------------------- | ----------------------------------------- | --------------------------- |
| `PORT`                 | Server port                               | `3000`                      |
| `LOG_LEVEL`            | Logging verbosity (DEBUG/INFO/WARN/ERROR) | `DEBUG`                     |
| `DATABASE_URL`         | PostgreSQL connection string              | Required                    |
| `JWT_SECRET`           | Secret key for signing JWTs               | Required                    |
| `JWT_EXPIRATION`       | JWT token expiration (e.g., "7d", "24h")  | `7d`                        |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                    | Optional                    |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                | Optional                    |
| `GOOGLE_CALLBACK_URL`  | Google OAuth callback URL                 | `/api/auth/google/callback` |

---

## Authentication

This server uses PassportJS for authentication with support for:

- **Local Strategy**: Email/password authentication
- **Google OAuth**: Sign in with Google
- **JWT**: Bearer token authentication for protected routes

### Authentication Files

```
src/
├── config/
│   ├── database.ts       # Prisma client singleton
│   └── passport.ts       # Passport strategies configuration
├── middleware/
│   └── auth.middleware.ts  # Authentication middlewares
├── schemas/
│   └── auth.schema.ts    # Login/register validation schemas
└── utils/
    ├── jwt.ts            # JWT generation/verification
    └── password.ts       # Password hashing utilities
```

### Protecting Routes

Use the `authenticate` middleware to protect routes:

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getProfile } from "../controllers/user.controller";

const router = Router();

// Protected route - requires Bearer token
router.get("/profile", authenticate, getProfile);

export default router;
```

After authentication, the user is available on `req.user`:

```typescript
import { Request, Response } from "express";
import { sendSuccess } from "../utils/response";

export const getProfile = async (req: Request, res: Response) => {
  const user = req.user!; // Authenticated user
  sendSuccess(res, {
    user: { id: user.id, email: user.email, name: user.name },
  });
};
```

### Optional Authentication

For routes that work for both authenticated and unauthenticated users:

```typescript
import { optionalAuth } from "../middleware/auth.middleware";

router.get("/public", optionalAuth, (req, res) => {
  if (req.user) {
    // User is authenticated
  } else {
    // User is a guest
  }
});
```

### Local Authentication (Login)

Use the `authenticateLocal` middleware for login routes:

```typescript
import { authenticateLocal } from "../middleware/auth.middleware";
import { generateToken } from "../utils/jwt";

router.post(
  "/login",
  validateRequest(LoginSchema),
  authenticateLocal,
  (req, res) => {
    const user = req.user!;
    const token = generateToken({ userId: user.id, email: user.email });
    sendSuccess(res, {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  },
);
```

### User Registration

Use the password utility to hash passwords:

```typescript
import { hashPassword } from "../utils/password";
import prisma from "../config/database";
import { generateToken } from "../utils/jwt";

export const register = async (req: Request, res: Response) => {
  const { email, password, name, nickname } = req.body;

  // Hash password before storing
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      nickname,
    },
  });

  const token = generateToken({ userId: user.id, email: user.email });
  sendSuccess(
    res,
    { token, user: { id: user.id, email: user.email, name: user.name } },
    201,
  );
};
```

### Auth Schemas

Available schemas in `/schemas/auth.schema.ts`:

```typescript
import {
  RegisterSchema,
  LoginSchema,
  RegisterInput,
  LoginInput,
} from "../schemas/auth.schema";

// Use with validateRequest middleware
router.post("/register", validateRequest(RegisterSchema), registerController);
router.post("/login", validateRequest(LoginSchema), loginController);
```
