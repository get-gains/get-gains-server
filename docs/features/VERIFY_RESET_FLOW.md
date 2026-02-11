# Email Verification & Password Reset Flows — Server Implementation

> **Status**: ✅ Implemented  
> **Last Updated**: February 11, 2026  
> **Covers**: Supabase email verification configuration, password reset redirect changes, new server endpoint for token exchange  
> **Depends On**: [AUTH.md](AUTH.md), [CONTEXT.md](../CONTEXT.md)

---

## Overview

### Purpose

This document details the **server-side** changes required to support:

1. **Email Verification Flow** — After registration, Supabase sends a verification email. The link points to the **web app**, which verifies the token and deep links back to the Flutter app.
2. **Forgot Password Flow** — User requests a password reset from the Flutter app. Supabase sends a recovery email linking to the **web app**, which exchanges the token and deep links back to the Flutter app with an access token for the password reset screen.

### Current State

| Component | Status | Notes |
|-----------|--------|-------|
| `POST /auth/register` | ✅ Updated | Creates Supabase user + Prisma user. Includes `emailRedirectTo`. Never returns tokens — email verification required. |
| `POST /auth/login` | ✅ Exists | Already returns 403 with `"Email not confirmed"` message if email is unverified. |
| `POST /auth/send-recovery-email` | ✅ Updated | Calls `supabase.auth.resetPasswordForEmail()` with `PASSWORD_RESET_REDIRECT_URL`. |
| `POST /auth/reset-password` | ✅ Updated | Uses Bearer token from header only. Uses `setSession` before `updateUser`. |
| `POST /auth/exchange-code` | ✅ Implemented | Web app exchanges Supabase PKCE code for session tokens. |
| `POST /auth/check-email-verified` | ✅ Implemented | Flutter app can check if user's email is verified. |
| `FLUTTER_RESET_PASSWORD_PAGE` env var | ❌ Removed | Replaced by `PASSWORD_RESET_REDIRECT_URL`. |

### What Changes

| Change | Type | Status |
|--------|------|--------|
| Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` | Config | ✅ Done |
| Update `FLUTTER_RESET_PASSWORD_PAGE` → `PASSWORD_RESET_REDIRECT_URL` | Config | ✅ Done |
| Add `EMAIL_VERIFICATION_REDIRECT_URL` env var | Config | ✅ Done |
| Configure Supabase email templates | Config | ⚠️ Manual step — see Step 2 |
| Add `POST /auth/exchange-code` endpoint | New Endpoint | ✅ Done |
| Update `POST /auth/reset-password` endpoint | Modification | ✅ Done |
| Add `POST /auth/check-email-verified` endpoint | New Endpoint | ✅ Done |

> **Note**: `SUPABASE_ANON_KEY` is **not** needed on the server. The server uses `SUPABASE_SERVICE_ROLE_KEY` which has full admin privileges and can perform all operations the anon key can. The anon key is only needed for client-side apps (web/mobile) that rely on Supabase Row Level Security.

---

## Architecture

### Email Verification Flow (Server's Role)

```
┌─────────────┐     POST /auth/register      ┌──────────────┐
│ Flutter App  │ ──────────────────────────── → │   Server     │
└─────────────┘                                └──────┬───────┘
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │   Supabase   │
                                              │  signUp()    │
                                              └──────┬───────┘
                                                      │
                                        Supabase sends verification email
                                        with redirect to WEB_APP_URL/auth/confirm
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │  User Email  │
                                              │  (Inbox)     │
                                              └──────┬───────┘
                                                      │
                                            User clicks link
                                                      │
                                                      ▼
┌──────────────┐   POST /auth/exchange-code   ┌──────────────┐
│   Web App    │ ──────────────────────────── → │   Server     │
│  /auth/      │                               │              │
│   confirm    │   { code }                    │  Exchange    │
└──────┬───────┘                               │  code for   │
       │          ← { verified: true }         │  session     │
       │                                       └──────────────┘
       │
       ▼
  Deep link → Flutter App → "Email verified" screen
```

### Password Reset Flow (Server's Role)

```
┌─────────────┐  POST /auth/send-recovery-email  ┌──────────────┐
│ Flutter App  │ ────────────────────────────── → │   Server     │
│ (Forgot PW)  │                                  └──────┬───────┘
└─────────────┘                                          │
                                                         ▼
                                                 ┌──────────────┐
                                                 │   Supabase   │
                                                 │  resetPW()   │
                                                 └──────┬───────┘
                                                         │
                                           Supabase sends reset email
                                           with redirect to WEB_APP_URL/auth/reset
                                                         │
                                                         ▼
                                                 ┌──────────────┐
                                                 │  User Email  │
                                                 └──────┬───────┘
                                                         │
                                               User clicks link
                                                         │
                                                         ▼
┌──────────────┐    POST /auth/exchange-code     ┌──────────────┐
│   Web App    │ ────────────────────────────── → │   Server     │
│  /auth/reset │                                 │              │
│              │    { code }                     │  Exchange    │
└──────┬───────┘                                 │  code for   │
       │           ← { accessToken,              │  session     │
       │              refreshToken }             └──────────────┘
       │
       ▼
  Deep link → Flutter App → Reset Password Screen
       │
       ▼
┌─────────────┐   POST /auth/reset-password     ┌──────────────┐
│ Flutter App  │ ────────────────────────────── → │   Server     │
│ (New PW form)│   Bearer <accessToken>          │              │
│              │   { newPassword }                │  Update PW   │
└─────────────┘                                  └──────────────┘
```

---

## Implementation Steps

### Step 1: Environment Variables

**File**: `.env`

Add/update the following variables:

```env
# Supabase (ensure these exist)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Web App URL (where Supabase redirects after email actions)
WEB_APP_URL=https://your-web-app.com

# Supabase redirect URLs (constructed from WEB_APP_URL)
EMAIL_VERIFICATION_REDIRECT_URL=https://your-web-app.com/auth/confirm
PASSWORD_RESET_REDIRECT_URL=https://your-web-app.com/auth/reset
```

**Remove** `FLUTTER_RESET_PASSWORD_PAGE` — replaced by `PASSWORD_RESET_REDIRECT_URL`.

---

### Step 2: Configure Supabase Dashboard

> ⚠️ This is a manual step in the Supabase Dashboard, not code.

1. **Go to**: Supabase Dashboard → Authentication → URL Configuration
2. **Site URL**: Set to your web app URL (e.g., `https://your-web-app.com`)
3. **Redirect URLs**: Add:
   - `https://your-web-app.com/auth/confirm`
   - `https://your-web-app.com/auth/reset`
   - `http://localhost:3000/auth/confirm` (for local dev)
   - `http://localhost:3000/auth/reset` (for local dev)

4. **Go to**: Supabase Dashboard → Authentication → Email Templates
5. **Confirm signup** template: Ensure the `{{ .ConfirmationURL }}` is used (Supabase auto-appends redirect)
6. **Reset password** template: Ensure the `{{ .ConfirmationURL }}` is used

7. **Go to**: Supabase Dashboard → Authentication → Settings
8. **Enable "Confirm email"**: Toggle ON (requires email verification before login)
9. **Enable PKCE flow**: Supabase v2 uses PKCE by default — the email link will contain a `code` parameter instead of raw tokens

> **Important**: With PKCE flow enabled, Supabase email links redirect with `?code=xxx` query parameter. The web app must exchange this code for a session via the Supabase client library.

---

### Step 3: Update Registration Controller

**File**: `src/controllers/auth.controller.ts`

**Change**: Update `registerWithEmailAndPassword` to include `emailRedirectTo` option and **never return tokens** (email must be verified first).

```typescript
// CURRENT (problematic):
const { data, error: supabaseError } = await supabase.auth.signUp({
  email: email.toLowerCase(),
  password,
});

// UPDATED:
const { data, error: supabaseError } = await supabase.auth.signUp({
  email: email.toLowerCase(),
  password,
  options: {
    emailRedirectTo: process.env.EMAIL_VERIFICATION_REDIRECT_URL,
  },
});
```

**Also update the response**: The registration endpoint should **never** return session tokens when email verification is required. Currently, if Supabase returns a session (which it does when email confirmation is disabled), the controller returns tokens. With email confirmation enabled, Supabase will return `data.session = null`, so the controller already handles this path — but we should make it explicit:

```typescript
// After creating user in Prisma:
// Always return user data without tokens — email verification is required
sendSuccess(
  res,
  {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      supabaseId: user.supabaseId,
    },
    message: 'Registration successful. Please check your email to verify your account.',
  },
  201
);
return;
```

Remove the conditional block that returns tokens on registration.

---

### Step 4: Update Recovery Email Controller

**File**: `src/controllers/auth.controller.ts`

**Change**: Use the new `PASSWORD_RESET_REDIRECT_URL` env var.

```typescript
// CURRENT:
const { error } = await supabase.auth.resetPasswordForEmail(
  email.toLowerCase(),
  {
    redirectTo: process.env.FLUTTER_RESET_PASSWORD_PAGE,
  }
);

// UPDATED:
const { error } = await supabase.auth.resetPasswordForEmail(
  email.toLowerCase(),
  {
    redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL,
  }
);
```

---

### Step 5: Add Token Exchange Endpoint

**File**: `src/schemas/auth.schema.ts` — Add new schema

```typescript
/**
 * Schema for exchanging Supabase auth code for session
 */
export const ExchangeCodeSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Auth code is required'),
  }),
});

export type ExchangeCodeInput = z.infer<typeof ExchangeCodeSchema>['body'];
```

**File**: `src/controllers/auth.controller.ts` — Add new controller

```typescript
/**
 * Exchange Supabase auth code for session tokens.
 *
 * This endpoint is called by the web app after Supabase redirects
 * with a PKCE auth code (from email verification or password reset links).
 *
 * The Supabase code is exchanged server-side using the service role client
 * to get a valid session with access and refresh tokens.
 *
 * POST /api/auth/exchange-code
 */
export const exchangeCodeForSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { code }: ExchangeCodeInput = req.body;

    logger.debug('Exchanging auth code for session');

    // Exchange the code for a session using Supabase
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      logger.error('Code exchange failed', { error });
      sendSingleError(res, 'Invalid or expired code', 401);
      return;
    }

    const { session, user } = data;

    // Check if this user exists in our database
    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    sendSuccess(res, {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      emailVerified: user.email_confirmed_at !== null,
      user: appUser
        ? {
            id: appUser.id,
            email: appUser.email,
            name: appUser.name,
            nickname: appUser.nickname,
            supabaseId: appUser.supabaseId,
          }
        : null,
    });
  } catch (error) {
    logger.error('Code exchange error', error);
    sendSingleError(res, 'Internal server error', 500);
  }
};
```

**File**: `src/routes/auth.routes.ts` — Register new route

```typescript
import { ExchangeCodeSchema } from '../schemas/auth.schema';
import { exchangeCodeForSession } from '../controllers/auth.controller';

/**
 * @route   POST /auth/exchange-code
 * @desc    Exchange Supabase PKCE auth code for session tokens
 * @access  Public (called by web app)
 */
router.post(
  '/exchange-code',
  validateRequest(ExchangeCodeSchema),
  exchangeCodeForSession
);
```

---

### Step 6: Update Reset Password Endpoint

**File**: `src/schemas/auth.schema.ts`

Simplify the schema — remove `accessToken` from the body since we use the Bearer token from the header:

```typescript
// UPDATED ResetPasswordSchema
export const ResetPasswordSchema = z.object({
  body: z.object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be less than 100 characters')
      .refine(
        (password) => /[A-Z]/.test(password),
        'Password must contain at least 1 capital letter'
      )
      .refine(
        (password) => passwordRegex.test(password),
        'Password must contain at least 1 special character'
      ),
  }),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>['body'];
```

**File**: `src/controllers/auth.controller.ts`

Update the controller to use the session from `authenticateSupabaseUser` middleware instead of body `accessToken`:

```typescript
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { newPassword }: ResetPasswordInput = req.body;

    // The user is already authenticated via Bearer token (authenticateSupabaseUser middleware)
    // We need to use the access token from the Authorization header to set the Supabase session
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!accessToken) {
      sendSingleError(res, 'Access token is required', 400);
      return;
    }

    // Set the session so Supabase knows which user to update
    // The access token from the recovery flow is a valid JWT
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: '', // Not needed for password update
    });

    if (sessionError) {
      logger.error('Failed to set session for password reset', { error: sessionError });
      sendSingleError(res, 'Invalid recovery session', 401);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      logger.error('Password reset failed', { error });
      sendSingleError(res, 'Failed to reset password', 500);
      return;
    }

    // Sign out the user from Supabase to invalidate the recovery session
    await supabase.auth.signOut();

    sendSuccess(res, { message: 'Password reset successfully' }, 200);
    return;
  } catch (error) {
    logger.error('Password reset error', error);
    sendSingleError(res, 'Internal server error', 500);
    return;
  }
};
```

---

### Step 7: Add Email Verification Status Endpoint (Optional)

This allows the Flutter app to poll or check whether a user's email has been verified.

**File**: `src/schemas/auth.schema.ts`

```typescript
export const CheckEmailVerifiedSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type CheckEmailVerifiedInput = z.infer<typeof CheckEmailVerifiedSchema>['body'];
```

**File**: `src/controllers/auth.controller.ts`

```typescript
/**
 * Check if a user's email has been verified in Supabase.
 * Used by the Flutter app's "Check Email" screen to poll verification status.
 *
 * POST /api/auth/check-email-verified
 */
export const checkEmailVerified = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email }: CheckEmailVerifiedInput = req.body;

    // Look up the user by email in our DB to get their supabaseId
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal whether email exists
      sendSuccess(res, { verified: false });
      return;
    }

    // Use admin API to get user from Supabase
    const { data, error } = await supabase.auth.admin.getUserById(user.supabaseId);

    if (error || !data.user) {
      sendSuccess(res, { verified: false });
      return;
    }

    sendSuccess(res, {
      verified: data.user.email_confirmed_at !== null,
    });
  } catch (error) {
    logger.error('Check email verified error', error);
    sendSingleError(res, 'Internal server error', 500);
  }
};
```

**File**: `src/routes/auth.routes.ts`

```typescript
/**
 * @route   POST /auth/check-email-verified
 * @desc    Check if user's email is verified
 * @access  Public
 */
router.post(
  '/check-email-verified',
  validateRequest(CheckEmailVerifiedSchema),
  checkEmailVerified
);
```

---

## Updated API Reference

### New Endpoints

#### `POST /api/auth/exchange-code`

Exchange a Supabase PKCE auth code for session tokens. Called by the web app.

**Request:**
```json
{
  "code": "pkce-auth-code-from-supabase-redirect"
}
```

**Success Response (200):**
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.refresh...",
    "emailVerified": true,
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

**Note**: `user` may be `null` if the Supabase user exists but hasn't been created in the app's database yet (edge case).

**Error Response (401):**
```json
{
  "data": null,
  "errors": [{ "message": "Invalid or expired code" }]
}
```

---

#### `POST /api/auth/check-email-verified`

Check if a user's email has been verified.

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
    "verified": true
  },
  "errors": []
}
```

---

#### `POST /api/auth/reset-password` (Updated)

**Breaking Change**: Removed `accessToken` from request body. The token is now only taken from the `Authorization: Bearer` header.

**Headers:**
```
Authorization: Bearer <access-token-from-recovery-flow>
```

**Request (Updated):**
```json
{
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

#### `POST /api/auth/register` (Updated Behavior)

**Behavioral Change**: Now **never** returns tokens. Always returns user data + verification message.

**Success Response (201):**
```json
{
  "data": {
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "John Doe",
      "nickname": "johnd",
      "supabaseId": "uuid..."
    },
    "message": "Registration successful. Please check your email to verify your account."
  },
  "errors": []
}
```

---

## Updated Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | `eyJ...` |

| `WEB_APP_URL` | Web app base URL | `https://your-web-app.com` |
| `EMAIL_VERIFICATION_REDIRECT_URL` | Supabase email verify redirect | `https://your-web-app.com/auth/confirm` |
| `PASSWORD_RESET_REDIRECT_URL` | Supabase password reset redirect | `https://your-web-app.com/auth/reset` |

**Removed**: `FLUTTER_RESET_PASSWORD_PAGE`

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `.env` | **Modify** | Add new env vars, remove `FLUTTER_RESET_PASSWORD_PAGE` |
| `src/schemas/auth.schema.ts` | **Modify** | Add `ExchangeCodeSchema`, `CheckEmailVerifiedSchema`; simplify `ResetPasswordSchema` |
| `src/controllers/auth.controller.ts` | **Modify** | Update `registerWithEmailAndPassword`, `sendRecoveryEmail`, `resetPassword`; add `exchangeCodeForSession`, `checkEmailVerified` |
| `src/routes/auth.routes.ts` | **Modify** | Add routes for `/exchange-code`, `/check-email-verified` |
| Supabase Dashboard | **Manual** | Configure redirect URLs, enable email confirmation, verify PKCE flow |

---

## Implementation Checklist

- [x] Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` to `.env.example`
- [x] Add `WEB_APP_URL`, `EMAIL_VERIFICATION_REDIRECT_URL`, `PASSWORD_RESET_REDIRECT_URL` to `.env.example`
- [x] Remove `FLUTTER_RESET_PASSWORD_PAGE` usage from code
- [ ] Configure Supabase Dashboard redirect URLs _(manual step)_
- [ ] Enable "Confirm email" in Supabase Dashboard _(manual step)_
- [x] Update `registerWithEmailAndPassword` — add `emailRedirectTo`, remove token response
- [x] Update `sendRecoveryEmail` — use `PASSWORD_RESET_REDIRECT_URL`
- [x] Update `resetPassword` — remove `accessToken` from body, use Bearer token + `setSession`
- [x] Add `ExchangeCodeSchema` to `auth.schema.ts`
- [x] Add `CheckEmailVerifiedSchema` to `auth.schema.ts`
- [x] Simplify `ResetPasswordSchema` (remove `accessToken` field)
- [x] Add `exchangeCodeForSession` controller
- [x] Add `checkEmailVerified` controller
- [x] Add new routes to `auth.routes.ts`
- [ ] Update [AUTH.md](AUTH.md) with new endpoints
- [ ] Test email verification end-to-end
- [ ] Test password reset end-to-end

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [AUTH.md](AUTH.md) | Full auth feature reference (update after implementation) |
| [Web App — VERIFY_RESET_FLOW.md](../../get-gains-web/docs/features/VERIFY_RESET_FLOW.md) | Web app implementation for this flow |
| [Flutter App — VERIFY_RESET_FLOW.md](../../get_gains_app/docs/features/VERIFY_RESET_FLOW.md) | Flutter app implementation for this flow |
| [CONTEXT.md](../CONTEXT.md) | Server patterns and conventions |

---

*Last updated: February 11, 2026*
