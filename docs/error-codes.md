# API Error Codes Reference

> **Generated from** `src/lib/errors/codes.ts` (108 codes)
>
> Codes are SCREAMING_SNAKE_CASE, prefixed by domain. Once shipped, they are **public API — add, never rename**.

## Envelope format

```jsonc
{
  "data": null,
  "errors": [
    {
      "code": "AUTH_INVALID_CREDENTIALS", // machine-readable
      "message": "Invalid email or password", // human-readable
      "field": "email", // optional
    },
  ],
}
```

## Error code table

### Cross-cutting

| Code                   | HTTP | Meaning                                           |
| ---------------------- | ---- | ------------------------------------------------- |
| `VALIDATION_ERROR`     | 400  | Request body/query/params failed Zod validation   |
| `UNAUTHENTICATED`      | 401  | No valid auth token provided                      |
| `FORBIDDEN`            | 403  | Authenticated but not authorized for the resource |
| `ROUTE_NOT_FOUND`      | 404  | No route matches the request method + path        |
| `UNEXPECTED_EXCEPTION` | 500  | Unhandled server error                            |
| `RATE_LIMITED`         | 429  | Too many requests                                 |
| `PAYLOAD_TOO_LARGE`    | 413  | Request payload exceeds limit                     |

### Upload

| Code                       | HTTP | Meaning                                                |
| -------------------------- | ---- | ------------------------------------------------------ |
| `UPLOAD_FILE_TOO_LARGE`    | 400  | File exceeds 5 MB limit                                |
| `UPLOAD_INVALID_FILE_TYPE` | 400  | File type not in allowed set (jpeg/png/webp/heic/heif) |
| `UPLOAD_FAILED`            | 400  | General upload processing failure                      |

### Auth

| Code                           | HTTP | Meaning                                      |
| ------------------------------ | ---- | -------------------------------------------- |
| `AUTH_TOKEN_MISSING`           | 401  | Authorization header not present             |
| `AUTH_TOKEN_INVALID`           | 401  | Token could not be verified                  |
| `AUTH_TOKEN_EXPIRED`           | 401  | Token has expired                            |
| `AUTH_USER_NOT_FOUND`          | 401  | Supabase user not found for token            |
| `AUTH_APP_USER_NOT_FOUND`      | 401  | No app user row for this Supabase ID         |
| `AUTH_COACH_REQUIRED`          | 403  | Endpoint requires a Coach role               |
| `AUTH_INVALID_CREDENTIALS`     | 401  | Wrong email or password                      |
| `AUTH_EMAIL_NOT_VERIFIED`      | 403  | Email address not yet verified               |
| `AUTH_EMAIL_ALREADY_EXISTS`    | 409  | Email already registered                     |
| `AUTH_USER_BANNED`             | 403  | Account is banned                            |
| `AUTH_SIGNUP_DISABLED`         | 403  | Signups are currently disabled               |
| `AUTH_WEAK_PASSWORD`           | 400  | Password does not meet strength requirements |
| `AUTH_SAME_PASSWORD`           | 400  | New password is the same as the old one      |
| `AUTH_RATE_LIMITED`            | 429  | Auth endpoint rate-limited                   |
| `AUTH_SESSION_EXPIRED`         | 401  | Session has expired                          |
| `AUTH_BAD_JWT`                 | 401  | Malformed JWT                                |
| `AUTH_OAUTH_FAILED`            | 400  | OAuth flow failed                            |
| `AUTH_PROVIDER_ERROR`          | 400  | Auth provider returned an error              |
| `AUTH_REFRESH_FAILED`          | 401  | Token refresh failed                         |
| `AUTH_CODE_EXCHANGE_FAILED`    | 400  | OAuth code exchange failed                   |
| `AUTH_TOKEN_GENERATION_FAILED` | 500  | Could not generate auth tokens               |
| `AUTH_ID_TOKEN_REQUIRED`       | 400  | ID token required for this auth flow         |
| `AUTH_ID_TOKEN_INVALID`        | 401  | ID token could not be verified               |

### Subscription

| Code                                | HTTP | Meaning                                 |
| ----------------------------------- | ---- | --------------------------------------- |
| `SUBSCRIPTION_REQUIRED`             | 402  | Active subscription required            |
| `SUBSCRIPTION_TIER_INSUFFICIENT`    | 402  | Higher subscription tier required       |
| `SUBSCRIPTION_INVALID_SESSION`      | 400  | Invalid subscription session            |
| `SUBSCRIPTION_NOT_FOUND`            | 404  | Subscription record not found           |
| `SUBSCRIPTION_SYNC_FAILED`          | 500  | Failed to sync subscription status      |
| `SUBSCRIPTION_HISTORY_FETCH_FAILED` | 500  | Failed to retrieve subscription history |

### RevenueCat

| Code                           | HTTP | Meaning                                                 |
| ------------------------------ | ---- | ------------------------------------------------------- |
| `REVENUECAT_INVALID_SIGNATURE` | 400  | Webhook signature verification failed                   |
| `REVENUECAT_UNKNOWN_EVENT`     | 400  | Unrecognized webhook event type                         |
| `REVENUECAT_USER_MISMATCH`     | 400  | Webhook user does not match expected user               |
| `REVENUECAT_DUPLICATE_EVENT`   | 200  | Duplicate webhook event (acknowledged, not reprocessed) |

### User

| Code                              | HTTP | Meaning                              |
| --------------------------------- | ---- | ------------------------------------ |
| `USER_NOT_FOUND`                  | 404  | User not found                       |
| `USER_USERNAME_TAKEN`             | 409  | Username already in use              |
| `USER_EMAIL_TAKEN`                | 409  | Email already in use                 |
| `USER_ALREADY_EXISTS`             | 409  | User already exists                  |
| `USER_COACH_NOT_FOUND`            | 404  | Coach not found                      |
| `USER_COACH_ALREADY_SUBSCRIBED`   | 409  | Already subscribed to this coach     |
| `USER_COACH_NOT_ACCEPTING`        | 400  | Coach is not accepting new clients   |
| `USER_COACH_AT_CAPACITY`          | 400  | Coach has reached client capacity    |
| `USER_COACH_NOT_SUBSCRIBED`       | 400  | Not subscribed to this coach         |
| `USER_COACH_ALREADY_UNSUBSCRIBED` | 400  | Already unsubscribed from this coach |

### Profile

| Code                            | HTTP | Meaning                                |
| ------------------------------- | ---- | -------------------------------------- |
| `PROFILE_NOT_FOUND`             | 404  | Profile not found                      |
| `PROFILE_CREATE_FAILED`         | 500  | Failed to create profile               |
| `PROFILE_UPDATE_FAILED`         | 500  | Failed to update profile               |
| `PROFILE_AVATAR_UPLOAD_FAILED`  | 500  | Avatar upload/processing failed        |
| `PROFILE_CLIENT_NOT_SUBSCRIBED` | 403  | Client is not subscribed to this coach |
| `PROFILE_CLIENT_NOT_FOUND`      | 404  | Client profile not found               |

### Prisma (generic)

| Code                        | HTTP | Meaning                                      |
| --------------------------- | ---- | -------------------------------------------- |
| `GENERIC_UNIQUE_CONSTRAINT` | 409  | Unique constraint violated (Prisma P2002)    |
| `GENERIC_NOT_FOUND`         | 404  | Record not found (Prisma P2025)              |
| `GENERIC_FOREIGN_KEY`       | 400  | Foreign key constraint failed (Prisma P2003) |

### Workout core

| Code                                | HTTP | Meaning                                |
| ----------------------------------- | ---- | -------------------------------------- |
| `WORKOUT_EXERCISE_NOT_FOUND`        | 404  | Exercise not found                     |
| `WORKOUT_EXERCISE_DUPLICATE_NAME`   | 409  | Exercise name already exists           |
| `WORKOUT_EXERCISE_FORBIDDEN`        | 403  | Not authorized to modify this exercise |
| `WORKOUT_ROUTINE_NOT_FOUND`         | 404  | Routine not found                      |
| `WORKOUT_SESSION_NOT_FOUND`         | 404  | Workout session not found              |
| `WORKOUT_SESSION_ALREADY_ACTIVE`    | 409  | A workout session is already active    |
| `WORKOUT_SESSION_NOT_ACTIVE`        | 400  | Session is not currently active        |
| `WORKOUT_SESSION_ALREADY_COMPLETED` | 400  | Session has already been completed     |
| `WORKOUT_SET_NOT_FOUND`             | 404  | Performed set not found                |
| `WORKOUT_SET_ORDER_CONFLICT`        | 409  | Set order conflict                     |
| `WORKOUT_BATCH_SYNC_FAILED`         | 500  | Batch sync operation failed            |
| `WORKOUT_WEEKLY_STATS_UNAVAILABLE`  | 500  | Weekly stats could not be computed     |

### Program / Coach / Assignment

| Code                           | HTTP | Meaning                                    |
| ------------------------------ | ---- | ------------------------------------------ |
| `PROGRAM_NOT_FOUND`            | 404  | Program not found                          |
| `PROGRAM_DUPLICATE_NAME`       | 409  | Program name already exists for this coach |
| `PROGRAM_FORBIDDEN`            | 403  | Not authorized to modify this program      |
| `ASSIGNMENT_NOT_FOUND`         | 404  | Assignment not found                       |
| `ASSIGNMENT_ALREADY_EXISTS`    | 409  | Program already assigned to this user      |
| `ASSIGNMENT_CLIENT_MISMATCH`   | 403  | Client does not match the assignment       |
| `COACH_ALREADY_EXISTS`         | 409  | Coach profile already exists               |
| `COACH_CLIENT_NOT_LINKED`      | 400  | Client is not linked to this coach         |
| `COACH_CLIENT_NOT_FOUND`       | 404  | Coach's client not found                   |
| `COACH_PROGRAM_LOCKED`         | 400  | Program is locked and cannot be modified   |
| `PROGRAM_ROUTINE_NOT_FOUND`    | 404  | Program routine not found                  |
| `PROGRAM_ROUTINE_DAY_CONFLICT` | 409  | Routine day already assigned in program    |
| `PROGRAM_REQUIRED`             | 400  | Program is required for this operation     |

### Workout ancillaries

| Code                           | HTTP | Meaning                               |
| ------------------------------ | ---- | ------------------------------------- |
| `STANDALONE_NOT_FOUND`         | 404  | Standalone workout not found          |
| `STANDALONE_ALREADY_COMPLETED` | 400  | Standalone workout already completed  |
| `SESSION_NOT_FOUND`            | 404  | Session not found                     |
| `SESSION_PERMISSION_DENIED`    | 403  | Not authorized to access this session |
| `TODAY_NO_ASSIGNED_WORKOUT`    | 404  | No workout assigned for today         |
| `STATS_RANGE_INVALID`          | 400  | Invalid date range for stats query    |
| `CLASS_NOT_FOUND`              | 404  | Class not found                       |
| `CLASS_CLIENT_ALREADY_REMOVED` | 400  | Client already removed from class     |

### Gamification

| Code                         | HTTP | Meaning                                          |
| ---------------------------- | ---- | ------------------------------------------------ |
| `COIN_INSUFFICIENT_BALANCE`  | 400  | Not enough coins for this purchase               |
| `COIN_HISTORY_FETCH_FAILED`  | 500  | Failed to retrieve coin history                  |
| `SHOP_ITEM_NOT_FOUND`        | 404  | Shop item not found or no longer available       |
| `SHOP_ITEM_ALREADY_OWNED`    | 409  | User already owns this cosmetic                  |
| `SHOP_ITEM_OUT_OF_STOCK`     | 400  | Shop item is out of stock                        |
| `COSMETIC_NOT_FOUND`         | 404  | Cosmetic not found or deleted                    |
| `COSMETIC_NOT_OWNED`         | 400  | User does not own this cosmetic                  |
| `COSMETIC_NOT_EQUIPPABLE`    | 400  | Cosmetic is not currently equipped (for unequip) |
| `LEADERBOARD_FETCH_FAILED`   | 500  | Failed to compute leaderboard                    |
| `LEADERBOARD_PERIOD_INVALID` | 400  | Invalid leaderboard period parameter             |
| `POSE_IMAGE_INVALID`         | 400  | Pose image could not be processed                |
| `POSE_ANALYSIS_FAILED`       | 500  | Pose analysis pipeline failed                    |
| `POSE_FORM_NOT_FOUND`        | 404  | Exercise form reference not found                |

## Special cases

### RevenueCat webhook (always 200)

The RevenueCat webhook controller (`revenuecat.controller.ts`) is the **one approved site** that catches errors locally and returns 200 regardless. Throwing from this handler would cause the global error filter to return 4xx/5xx, which makes RevenueCat retry indefinitely.

```ts
// revenuecat.controller.ts — approved inline catch
} catch (error) {
  logger.error('Webhook processing error', error);
  sendSuccess(res, { acknowledged: true, error: 'Processing error' });
}
```

### Dart client enum

The Dart enum is generated from these codes:

```bash
npm run codegen:errors
# → writes app/lib/core/errors/api_error_codes.dart
```

CI verifies the enum is in sync:

```bash
npm run codegen:errors && git diff --exit-code
```
