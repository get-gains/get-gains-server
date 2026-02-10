# Pose Detection - Backend Implementation Plan

> **Status**: ✅ Implemented (Coach Flow, Client Results, Download — pending migration)  
> **Last Updated**: February 11, 2026  
> **Covers**: Exercise Form Storage, Pose Landmark Data, Comparison Results, Limb Isolation Config  
> **Depends On**: [WORKOUT.md](WORKOUT.md), [COACH.md](COACH.md), [PROGRAM.md](PROGRAM.md)

---

## Overview

### Purpose

The Pose Detection backend provides **storage, retrieval, and record-keeping** for exercise form data used by the mobile app's on-device pose analysis:

- **Coach Form Recording**: Store reference pose landmark data recorded by coaches for exercises
- **Client Result Storage**: Persist comparison results and correction feedback from client recordings
- **Limb Isolation Config**: Define which body segments to focus on per exercise
- **Offline-First Support**: Serve form data for client-side caching/download
- **Historical Records**: Maintain a full history of client form attempts for progress tracking

### What the Server Does vs. What the App Does

| Responsibility | Server | App (Edge) |
|---------------|--------|------------|
| MLKit Pose Detection | ❌ | ✅ On-device |
| Feature Extraction (angles, distances) | ❌ | ✅ On-device |
| DTW Comparison | ❌ | ✅ On-device |
| Score Calculation | ❌ | ✅ On-device |
| Feedback Generation | ❌ | ✅ On-device |
| Store Coach Reference Forms | ✅ | ❌ |
| Store Client Results | ✅ | ❌ (generates, then uploads) |
| Serve Form Data for Download | ✅ | ❌ |
| Limb Isolation Configuration | ✅ | ❌ (reads config) |
| Historical Record Queries | ✅ | ❌ |

> **Key Principle**: All ML processing is on-device (edge). The server is a data store and API layer only.

### Scope

**This document covers:**
- Prisma schema additions for pose detection data
- API endpoints for coach form upload, client result submission, and retrieval
- Limb isolation configuration per exercise
- Offline-first data serving (bulk download)
- Historical records and progress queries

**Not Included:**
- MLKit pose detection logic (see App POSE_DETECTION.md)
- DTW comparison algorithm (see App POSE_DETECTION.md)
- Camera/video recording (see App POSE_DETECTION.md)
- Unity 3D replay visualization (see App POSE_DETECTION.md)

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | ^7.2.0 | Database operations |
| `zod` | ^4.3.5 | Request validation |
| `express` | ^5.2.1 | HTTP routing |

### Entry Points (To Be Created)

| File | Description |
|------|-------------|
| `/src/routes/pose.routes.ts` | Route definitions for all pose detection endpoints |
| `/src/controllers/pose.controller.ts` | Business logic for pose data operations |
| `/src/schemas/pose.schema.ts` | Zod validation schemas |
| `/prisma/schema.prisma` | New models (additions to existing schema) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        FLUTTER APP (EDGE DEVICE)                         │
│                                                                          │
│   COACH FLOW:                     CLIENT FLOW:                           │
│   Camera → MLKit → Landmarks      Camera → MLKit → Landmarks            │
│   → Features → POST to server     → Features → DTW Compare (on-device)  │
│                                    → Score + Corrections                 │
│                                    → POST results to server              │
└──────────────────────────────────────────────────────────────────────────┘
                        │                           │
                        ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          EXPRESS SERVER                                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                        POSE ROUTES                                 │  │
│  │  /api/pose/forms          → Coach form upload / retrieval          │  │
│  │  /api/pose/results        → Client result submission / history     │  │
│  │  /api/pose/exercises/:id/config → Limb isolation config            │  │
│  │  /api/pose/download       → Bulk form data for offline caching     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                        │                                                 │
│                        ▼                                                 │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │   VALIDATION MIDDLEWARE      │  │       AUTH MIDDLEWARE             │  │
│  │   (Zod Schemas)              │  │  requireAppUser / requireCoach   │  │
│  └──────────────────────────────┘  └──────────────────────────────────┘  │
│                        │                                                 │
│                        ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      POSE CONTROLLER                               │  │
│  │  uploadCoachForm, getExerciseForm, submitClientResult,             │  │
│  │  getClientHistory, getFormConfig, bulkDownloadForms                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                        │                                                 │
│                        ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                      PRISMA CLIENT                                 │  │
│  │  ExerciseForm, ExercisePoseConfig, FormComparisonResult models     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │   POSTGRESQL    │
              └─────────────────┘
```

---

## Database Schema Additions

### New Enums

```prisma
// Body segment groups for limb isolation
enum BodySegment {
  HEAD_NECK
  LEFT_ARM
  RIGHT_ARM
  TORSO
  LEFT_LEG
  RIGHT_LEG
  FULL_BODY
}

// Camera angle the form was recorded from
enum CameraAngle {
  FRONT
  SIDE_LEFT
  SIDE_RIGHT
  REAR
  ANGLE_45_LEFT
  ANGLE_45_RIGHT
}
```

### New Models

#### `ExercisePoseConfig` — Limb Isolation & Analysis Configuration

```prisma
// Per-exercise configuration for pose analysis
// Defines WHICH body segments matter and HOW to analyze them
model ExercisePoseConfig {
  id         String @id @default(cuid())
  exerciseId String @unique

  // Which body segments to analyze (limb isolation)
  // e.g., Squat = [TORSO, LEFT_LEG, RIGHT_LEG]
  // e.g., Bicep Curl = [LEFT_ARM, RIGHT_ARM]
  activeSegments BodySegment[]

  // Recommended camera angle(s) for this exercise
  recommendedAngles CameraAngle[]

  // Which specific angles (joint angles) to track and report corrections on
  // Stored as JSON array: [{ "name": "kneeFlexion", "landmarks": ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"], "idealMin": 80, "idealMax": 100 }]
  trackedAngles Json

  // Minimum landmark confidence threshold (0.0 - 1.0)
  // Landmarks below this are ignored during comparison
  minLandmarkConfidence Float @default(0.5)

  // Additional notes for the client UI (e.g., "Keep full body in frame")
  setupInstructions String? @db.Text

  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
}
```

#### `ExerciseForm` — Coach's Reference Form Recording

```prisma
// A single reference form recording uploaded by a coach for an exercise.
// Contains the processed pose landmark data (NOT video — video stays on device or is discarded).
model ExerciseForm {
  id         String @id @default(cuid())
  exerciseId String
  coachId    String

  // Recording metadata
  cameraAngle     CameraAngle
  durationMs      Int              // Duration of the recording in milliseconds
  frameRate       Int              // FPS the landmarks were captured at (e.g., 15 or 30)
  totalFrames     Int              // Total number of valid pose frames

  // The core data: processed pose landmarks per frame
  // JSON array of frames, each frame is an object with timestamp + landmarks
  // Structure: [{ "timestampMs": 0, "landmarks": { "LEFT_SHOULDER": { "x": 0.5, "y": 0.3, "z": 0.1, "confidence": 0.95 }, ... } }, ...]
  landmarkFrames Json

  // Pre-extracted feature vectors for faster client-side comparison
  // Structure: [{ "timestampMs": 0, "angles": { "kneeFlexion": 92.5, "hipHinge": 78.3, ... }, "distances": { ... } }, ...]
  featureFrames Json

  // Optional: normalized/Procrustes-aligned version for direct DTW input
  normalizedFrames Json?

  // Which form version this is (coach can re-record to improve)
  version    Int     @default(1)
  isActive   Boolean @default(true) // Only one active form per exercise per angle

  // Quality metadata from the app's recording validation
  avgLandmarkConfidence Float?
  recordingQuality      String? // "good", "acceptable", "poor"

  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  coach    Coach    @relation(fields: [coachId], references: [id], onDelete: Cascade)

  createdAt         DateTime               @default(now()) @db.Timestamptz
  updatedAt         DateTime               @updatedAt @db.Timestamptz
  comparisonResults FormComparisonResult[]

  @@index([exerciseId, isActive])
  @@index([coachId])
}
```

#### `FormComparisonResult` — Client's Comparison Record

```prisma
// A single form comparison attempt by a client
// The app performs DTW comparison on-device, then uploads the result here for records
model FormComparisonResult {
  id              String @id @default(cuid())
  userId          String
  exerciseFormId  String // Which coach reference form was compared against
  workoutSessionId String? // Optional link to the workout session this was part of
  routineExerciseId String? // Optional link to the specific routine exercise

  // Overall similarity score (0.0 - 1.0, where 1.0 = perfect match)
  overallScore Float

  // Per-segment scores (limb isolation results)
  // JSON: { "TORSO": 0.85, "LEFT_LEG": 0.72, "RIGHT_LEG": 0.78 }
  segmentScores Json

  // Angle corrections: specific joint angles that were off
  // JSON array: [{ "angleName": "kneeFlexion", "segment": "LEFT_LEG", "avgDeviation": 12.5, "maxDeviation": 25.0, "direction": "too_shallow", "message": "Your left knee didn't bend deep enough — average 12.5° off ideal" }]
  corrections Json

  // Client's recording metadata (for reference, video is NOT stored server-side)
  cameraAngle     CameraAngle
  durationMs      Int
  frameRate       Int
  totalFrames     Int
  avgLandmarkConfidence Float?

  // Optional: client's landmark frames (for future replay / advanced analysis)
  // This can be large — consider making it optional or a separate table
  clientLandmarkFrames Json?

  // Optional: client's feature frames
  clientFeatureFrames Json?

  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  exerciseForm    ExerciseForm      @relation(fields: [exerciseFormId], references: [id], onDelete: Cascade)
  workoutSession  WorkoutSession?   @relation(fields: [workoutSessionId], references: [id], onDelete: SetNull)
  routineExercise RoutineExercise?  @relation(fields: [routineExerciseId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now()) @db.Timestamptz

  @@index([userId, exerciseFormId])
  @@index([userId, createdAt])
  @@index([workoutSessionId])
}
```

### Existing Model Modifications

```prisma
// ADD relations to existing models:

model Exercise {
  // ... existing fields ...
  poseConfig       ExercisePoseConfig?
  exerciseForms    ExerciseForm[]
}

model Coach {
  // ... existing fields ...
  exerciseForms ExerciseForm[]
}

model User {
  // ... existing fields ...
  formComparisonResults FormComparisonResult[]
}

model WorkoutSession {
  // ... existing fields ...
  formComparisonResults FormComparisonResult[]
}

model RoutineExercise {
  // ... existing fields ...
  formComparisonResults FormComparisonResult[]
}
```

---

## API Endpoints

### Coach Form Endpoints (Require `requireCoach`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/pose/forms` | Upload a new reference form | Coach |
| `GET` | `/api/pose/forms/:formId` | Get a specific form by ID | Coach |
| `GET` | `/api/pose/exercises/:exerciseId/forms` | Get all forms for an exercise | Coach |
| `PUT` | `/api/pose/forms/:formId` | Update/replace a form | Coach |
| `DELETE` | `/api/pose/forms/:formId` | Delete a form | Coach |
| `PATCH` | `/api/pose/forms/:formId/activate` | Set a form as the active version | Coach |

### Exercise Pose Config Endpoints (Require `requireCoach`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `PUT` | `/api/pose/exercises/:exerciseId/config` | Create or update pose config | Coach |
| `GET` | `/api/pose/exercises/:exerciseId/config` | Get pose config for an exercise | Yes |

### Client Result Endpoints (Require `requireAppUser`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/pose/results` | Submit a comparison result | Yes |
| `GET` | `/api/pose/results` | Get user's comparison history | Yes |
| `GET` | `/api/pose/results/:resultId` | Get a specific result | Yes |
| `GET` | `/api/pose/results/exercise/:exerciseId` | Get results for a specific exercise | Yes |
| `GET` | `/api/pose/results/session/:sessionId` | Get results from a workout session | Yes |

### Offline-First Data Endpoints (Require `requireAppUser`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/pose/download/program/:programId` | Bulk download all active forms for a program | Yes |
| `GET` | `/api/pose/download/exercise/:exerciseId` | Download form data for a single exercise | Yes |

---

## Endpoint Details

### `POST /api/pose/forms` — Upload Coach Reference Form

**Auth**: `requireCoach`

**Request Body**:
```json
{
  "exerciseId": "clxex123...",
  "cameraAngle": "SIDE_LEFT",
  "durationMs": 10000,
  "frameRate": 15,
  "totalFrames": 150,
  "landmarkFrames": [
    {
      "timestampMs": 0,
      "landmarks": {
        "LEFT_SHOULDER": { "x": 0.52, "y": 0.31, "z": 0.08, "confidence": 0.97 },
        "LEFT_ELBOW": { "x": 0.55, "y": 0.48, "z": 0.05, "confidence": 0.94 },
        "LEFT_HIP": { "x": 0.50, "y": 0.58, "z": 0.10, "confidence": 0.96 },
        "LEFT_KNEE": { "x": 0.48, "y": 0.75, "z": 0.12, "confidence": 0.93 },
        "LEFT_ANKLE": { "x": 0.47, "y": 0.92, "z": 0.08, "confidence": 0.91 }
      }
    }
  ],
  "featureFrames": [
    {
      "timestampMs": 0,
      "angles": {
        "kneeFlexion": 92.5,
        "hipHinge": 78.3,
        "torsoLean": 15.2
      }
    }
  ],
  "normalizedFrames": null,
  "avgLandmarkConfidence": 0.94,
  "recordingQuality": "good"
}
```

**Success Response** (201):
```json
{
  "data": {
    "form": {
      "id": "clxpf123...",
      "exerciseId": "clxex123...",
      "coachId": "clxco123...",
      "cameraAngle": "SIDE_LEFT",
      "version": 1,
      "isActive": true,
      "totalFrames": 150,
      "durationMs": 10000,
      "createdAt": "2026-02-06T..."
    }
  },
  "errors": []
}
```

**Notes**:
- If another active form exists for the same exercise + angle, the previous one is auto-deactivated (`isActive = false`).
- The version auto-increments based on existing forms for the exercise.

---

### `POST /api/pose/results` — Submit Client Comparison Result

**Auth**: `requireAppUser`

**Request Body**:
```json
{
  "exerciseFormId": "clxpf123...",
  "workoutSessionId": "clxws123...",
  "routineExerciseId": "clxre123...",
  "overallScore": 0.78,
  "segmentScores": {
    "TORSO": 0.85,
    "LEFT_LEG": 0.72,
    "RIGHT_LEG": 0.78
  },
  "corrections": [
    {
      "angleName": "kneeFlexion",
      "segment": "LEFT_LEG",
      "avgDeviation": 12.5,
      "maxDeviation": 25.0,
      "direction": "too_shallow",
      "message": "Your left knee didn't bend deep enough — average 12.5° off ideal"
    },
    {
      "angleName": "torsoLean",
      "segment": "TORSO",
      "avgDeviation": 5.2,
      "maxDeviation": 10.1,
      "direction": "too_forward",
      "message": "Your torso leaned forward more than the reference — 5.2° avg deviation"
    }
  ],
  "cameraAngle": "SIDE_LEFT",
  "durationMs": 11500,
  "frameRate": 15,
  "totalFrames": 142,
  "avgLandmarkConfidence": 0.88,
  "clientLandmarkFrames": null,
  "clientFeatureFrames": null
}
```

**Success Response** (201):
```json
{
  "data": {
    "result": {
      "id": "clxcr123...",
      "overallScore": 0.78,
      "segmentScores": { "TORSO": 0.85, "LEFT_LEG": 0.72, "RIGHT_LEG": 0.78 },
      "corrections": [...],
      "createdAt": "2026-02-06T..."
    }
  },
  "errors": []
}
```

---

### `GET /api/pose/results` — Client History

**Auth**: `requireAppUser`

**Query Parameters**: `exerciseId?`, `limit?` (default 20), `offset?` (default 0), `from?`, `to?`

**Success Response** (200):
```json
{
  "data": {
    "results": [
      {
        "id": "clxcr123...",
        "overallScore": 0.78,
        "segmentScores": { "TORSO": 0.85, "LEFT_LEG": 0.72, "RIGHT_LEG": 0.78 },
        "corrections": [...],
        "cameraAngle": "SIDE_LEFT",
        "createdAt": "2026-02-06T...",
        "exerciseForm": {
          "id": "clxpf123...",
          "exercise": { "id": "clxex123...", "name": "Barbell Squat" },
          "coach": { "id": "clxco123...", "name": "Coach John" }
        }
      }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0
  },
  "errors": []
}
```

---

### `GET /api/pose/download/program/:programId` — Bulk Download

**Auth**: `requireAppUser`

Returns ALL active `ExerciseForm` data + `ExercisePoseConfig` for every exercise in the program. This is the primary endpoint for offline caching.

**Success Response** (200):
```json
{
  "data": {
    "programId": "clxpg123...",
    "programName": "Beginner Strength 8-Week",
    "exercises": [
      {
        "exerciseId": "clxex123...",
        "exerciseName": "Barbell Squat",
        "poseConfig": {
          "activeSegments": ["TORSO", "LEFT_LEG", "RIGHT_LEG"],
          "recommendedAngles": ["SIDE_LEFT", "SIDE_RIGHT"],
          "trackedAngles": [
            { "name": "kneeFlexion", "landmarks": ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"], "idealMin": 80, "idealMax": 100 },
            { "name": "hipHinge", "landmarks": ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"], "idealMin": 70, "idealMax": 90 },
            { "name": "torsoLean", "landmarks": ["LEFT_SHOULDER", "LEFT_HIP", "VERTICAL_REF"], "idealMin": 0, "idealMax": 30 }
          ],
          "minLandmarkConfidence": 0.5,
          "setupInstructions": "Stand sideways to the camera. Ensure full body is visible from head to feet."
        },
        "forms": [
          {
            "id": "clxpf123...",
            "cameraAngle": "SIDE_LEFT",
            "durationMs": 10000,
            "frameRate": 15,
            "totalFrames": 150,
            "landmarkFrames": [...],
            "featureFrames": [...],
            "normalizedFrames": [...],
            "version": 2,
            "coachName": "Coach John"
          }
        ]
      }
    ],
    "lastUpdatedAt": "2026-02-05T..."
  },
  "errors": []
}
```

**Notes**:
- Response can be large. The client should cache this in the local Drift database.
- Include a `lastUpdatedAt` so the client can do delta syncs (`If-Modified-Since` or query param).

---

### `PUT /api/pose/exercises/:exerciseId/config` — Set Pose Config

**Auth**: `requireCoach`

**Request Body**:
```json
{
  "activeSegments": ["TORSO", "LEFT_LEG", "RIGHT_LEG"],
  "recommendedAngles": ["SIDE_LEFT", "SIDE_RIGHT"],
  "trackedAngles": [
    {
      "name": "kneeFlexion",
      "landmarks": ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
      "idealMin": 80,
      "idealMax": 100
    },
    {
      "name": "hipHinge",
      "landmarks": ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
      "idealMin": 70,
      "idealMax": 90
    }
  ],
  "minLandmarkConfidence": 0.5,
  "setupInstructions": "Stand sideways to the camera, 6-8 feet away."
}
```

---

## Validation Schemas

### `pose.schema.ts`

```typescript
import { z } from "zod";

// --- Enums ---
const BodySegmentEnum = z.enum([
  "HEAD_NECK", "LEFT_ARM", "RIGHT_ARM", "TORSO", "LEFT_LEG", "RIGHT_LEG", "FULL_BODY"
]);

const CameraAngleEnum = z.enum([
  "FRONT", "SIDE_LEFT", "SIDE_RIGHT", "REAR", "ANGLE_45_LEFT", "ANGLE_45_RIGHT"
]);

// --- Landmark Structure ---
// Raw landmark coordinates are normalised by dividing pixel position by
// image dimensions, so values are *usually* 0-1.  However, MLKit can report
// positions outside the visible frame, and on Android the camera sensor is
// landscape while the phone is portrait — MLKit returns coordinates in the
// rotated space which, when divided by the un-rotated sensor dimension, can
// exceed 1.0 significantly (e.g. y ≈ 1.78 for 1920/1080).  We use a wide
// margin to accommodate all devices and edge cases.
const LandmarkSchema = z.object({
  x: z.number().min(-1.0).max(3.0),
  y: z.number().min(-1.0).max(3.0),
  z: z.number(),
  confidence: z.number().min(0).max(1),
});

const LandmarkFrameSchema = z.object({
  timestampMs: z.number().int().min(0),
  landmarks: z.record(z.string(), LandmarkSchema),
});

const FeatureFrameSchema = z.object({
  timestampMs: z.number().int().min(0),
  angles: z.record(z.string(), z.number()),
  distances: z.record(z.string(), z.number()).optional(),
});

// --- Tracked Angle Config ---
const TrackedAngleSchema = z.object({
  name: z.string().min(1),
  landmarks: z.array(z.string()).min(3).max(3),
  idealMin: z.number(),
  idealMax: z.number(),
});

// --- Correction ---
const CorrectionSchema = z.object({
  angleName: z.string(),
  segment: BodySegmentEnum,
  avgDeviation: z.number(),
  maxDeviation: z.number(),
  direction: z.string(), // "too_shallow", "too_deep", "too_forward", etc.
  message: z.string(),
});

// === COACH FORM ENDPOINTS ===

export const UploadFormSchema = z.object({
  body: z.object({
    exerciseId: z.string().min(1),
    cameraAngle: CameraAngleEnum,
    durationMs: z.number().int().positive(),
    frameRate: z.number().int().min(1).max(60),
    totalFrames: z.number().int().positive(),
    landmarkFrames: z.array(LandmarkFrameSchema).min(1),
    featureFrames: z.array(FeatureFrameSchema).min(1),
    normalizedFrames: z.array(LandmarkFrameSchema).nullable().optional(),
    avgLandmarkConfidence: z.number().min(0).max(1).optional(),
    recordingQuality: z.enum(["good", "acceptable", "poor"]).optional(),
  }),
});
export type UploadFormInput = z.infer<typeof UploadFormSchema>["body"];

export const GetExerciseFormsSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1),
  }),
  query: z.object({
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
});

export const FormIdParamSchema = z.object({
  params: z.object({
    formId: z.string().min(1),
  }),
});

// === POSE CONFIG ENDPOINTS ===

export const UpsertPoseConfigSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1),
  }),
  body: z.object({
    activeSegments: z.array(BodySegmentEnum).min(1),
    recommendedAngles: z.array(CameraAngleEnum).min(1),
    trackedAngles: z.array(TrackedAngleSchema).min(1),
    minLandmarkConfidence: z.number().min(0).max(1).optional().default(0.5),
    setupInstructions: z.string().optional(),
  }),
});
export type UpsertPoseConfigInput = z.infer<typeof UpsertPoseConfigSchema>["body"];

// === CLIENT RESULT ENDPOINTS ===

export const SubmitResultSchema = z.object({
  body: z.object({
    exerciseFormId: z.string().min(1),
    workoutSessionId: z.string().optional(),
    routineExerciseId: z.string().optional(),
    overallScore: z.number().min(0).max(1),
    segmentScores: z.record(BodySegmentEnum, z.number().min(0).max(1)),
    corrections: z.array(CorrectionSchema),
    cameraAngle: CameraAngleEnum,
    durationMs: z.number().int().positive(),
    frameRate: z.number().int().min(1).max(60),
    totalFrames: z.number().int().positive(),
    avgLandmarkConfidence: z.number().min(0).max(1).optional(),
    clientLandmarkFrames: z.array(LandmarkFrameSchema).nullable().optional(),
    clientFeatureFrames: z.array(FeatureFrameSchema).nullable().optional(),
  }),
});
export type SubmitResultInput = z.infer<typeof SubmitResultSchema>["body"];

export const ResultHistorySchema = z.object({
  query: z.object({
    exerciseId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
});

// === DOWNLOAD ENDPOINTS ===

export const DownloadProgramFormsSchema = z.object({
  params: z.object({
    programId: z.string().min(1),
  }),
  query: z.object({
    since: z.coerce.date().optional(), // For delta sync
  }),
});

export const DownloadExerciseFormSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1),
  }),
});
```

---

## Controller Logic Overview

### `pose.controller.ts` — Key Handlers

#### `uploadCoachForm`

```
1. Validate coach owns/created the exercise (or exercise is in their program)
2. Check if active form already exists for same exercise + cameraAngle
   → If yes, set existing form's isActive = false
3. Determine version number (max existing version + 1)
4. Create ExerciseForm record with landmarkFrames, featureFrames, normalizedFrames
5. Return created form (without heavy JSON payloads in response)
```

#### `submitClientResult`

```
1. Validate exerciseFormId exists and is active
2. Validate optional workoutSessionId belongs to user
3. Validate optional routineExerciseId exists
4. Create FormComparisonResult record
5. Return result with ID
```

#### `getClientHistory`

```
1. Query FormComparisonResult for userId
2. Apply optional filters: exerciseId, date range
3. Include exercise name and coach name via joins
4. Return paginated results (without heavy JSON payloads by default)
```

#### `bulkDownloadForms`

```
1. Validate user has an active AssignedProgram for programId
2. Query all exercises in program via Program → ProgramRoutine → Routine → RoutineExercise → Exercise
3. For each exercise, get active ExerciseForm(s) and ExercisePoseConfig
4. Apply "since" filter if provided (delta sync)
5. Return complete payload for offline caching
```

---

## Routes Structure

### `pose.routes.ts`

```typescript
import { Router } from "express";
import { requireAppUser, requireCoach } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validate.middleware";
import {
  uploadCoachForm,
  getFormById,
  getExerciseForms,
  updateForm,
  deleteForm,
  activateForm,
  upsertPoseConfig,
  getPoseConfig,
  submitClientResult,
  getClientHistory,
  getResultById,
  getResultsByExercise,
  getResultsBySession,
  bulkDownloadProgramForms,
  downloadExerciseForm,
} from "../controllers/pose.controller";
import {
  UploadFormSchema,
  FormIdParamSchema,
  GetExerciseFormsSchema,
  UpsertPoseConfigSchema,
  SubmitResultSchema,
  ResultHistorySchema,
  DownloadProgramFormsSchema,
  DownloadExerciseFormSchema,
} from "../schemas/pose.schema";

const router = Router();

// --- Coach Form Management ---
router.post("/forms", requireCoach, validateRequest(UploadFormSchema), uploadCoachForm);
router.get("/forms/:formId", requireCoach, validateRequest(FormIdParamSchema), getFormById);
router.get("/exercises/:exerciseId/forms", requireCoach, validateRequest(GetExerciseFormsSchema), getExerciseForms);
router.put("/forms/:formId", requireCoach, validateRequest(FormIdParamSchema), updateForm);
router.delete("/forms/:formId", requireCoach, validateRequest(FormIdParamSchema), deleteForm);
router.patch("/forms/:formId/activate", requireCoach, validateRequest(FormIdParamSchema), activateForm);

// --- Pose Config ---
router.put("/exercises/:exerciseId/config", requireCoach, validateRequest(UpsertPoseConfigSchema), upsertPoseConfig);
router.get("/exercises/:exerciseId/config", requireAppUser, getPoseConfig);

// --- Client Results ---
router.post("/results", requireAppUser, validateRequest(SubmitResultSchema), submitClientResult);
router.get("/results", requireAppUser, validateRequest(ResultHistorySchema), getClientHistory);
router.get("/results/:resultId", requireAppUser, getResultById);
router.get("/results/exercise/:exerciseId", requireAppUser, getResultsByExercise);
router.get("/results/session/:sessionId", requireAppUser, getResultsBySession);

// --- Offline Download ---
router.get("/download/program/:programId", requireAppUser, validateRequest(DownloadProgramFormsSchema), bulkDownloadProgramForms);
router.get("/download/exercise/:exerciseId", requireAppUser, validateRequest(DownloadExerciseFormSchema), downloadExerciseForm);

export default router;
```

### Register in `index.ts`

```typescript
import poseRoutes from "./routes/pose.routes";
app.use("/api/pose", poseRoutes);
```

---

## Data Size Considerations

### Landmark Frame Size Estimates

| Recording | Frames | Landmarks/Frame | Approx JSON Size |
|-----------|--------|-----------------|-------------------|
| 10s @ 15 FPS | 150 | 33 (MLKit full) | ~300 KB |
| 10s @ 30 FPS | 300 | 33 | ~600 KB |
| 30s @ 15 FPS | 450 | 33 | ~900 KB |
| 10s @ 15 FPS (isolated, 12 landmarks) | 150 | 12 | ~110 KB |

### Recommendations

1. **Store at 15 FPS** — sufficient for form comparison, halves data.
2. **Use limb isolation to filter landmarks before upload** — if only legs + torso matter (squat), store only those ~12 landmarks instead of all 33.
3. **Feature frames are smaller** — angles/distances only, ~50 KB for a 10s recording.
4. **`clientLandmarkFrames` on results should be optional** — only store if the user opts into "save recording for coach review."
5. **Consider compression** — gzip the JSON payload on upload (Express can handle this automatically).

---

## Implementation Order

### Phase 1: Foundation ✅ (Completed — Feb 6, 2026)

1. [x] Add Prisma schema changes (enums + 3 models + relation updates)
2. [x] Run `prisma generate` (migration deferred)
3. [x] Create `pose.schema.ts` with all Zod schemas
4. [x] Create `pose.controller.ts` with all handlers
5. [x] Create `pose.routes.ts` and register in `index.ts`

### Phase 2: Coach Form Flow ✅ (Completed — Feb 6, 2026)

6. [x] Implement `uploadCoachForm` controller (auto-version, auto-deactivate previous)
7. [x] Implement `getExerciseForms` and `getFormById`
8. [x] Implement `updateForm`, `deleteForm`, `activateForm`
9. [x] Implement `upsertPoseConfig` and `getPoseConfig`

### Phase 3: Client Result Flow ✅ (Completed — Feb 6, 2026)

10. [x] Implement `submitClientResult` controller
11. [x] Implement `getClientHistory` with pagination + filters
12. [x] Implement `getResultById`, `getResultsByExercise`, `getResultsBySession`

### Phase 4: Offline Download ✅ (Completed — Feb 6, 2026)

13. [x] Implement `bulkDownloadProgramForms`
14. [x] Implement `downloadExerciseForm`
15. [x] Add `since` delta sync support on bulk download

### Phase 5: Testing & Optimization (Pending)

16. [ ] Run `prisma migrate dev --name add_pose_detection`
17. [ ] Load test large landmark payloads
18. [ ] Add gzip compression if not already configured
19. [ ] Verify JSON column indexing on PostgreSQL

---

## Future Enhancements

- [ ] Coach review of client recordings (view client landmark frames)
- [ ] Aggregate form analytics per exercise per client (progress over time charts)
- [ ] Server-side form validation (sanity check landmark data before storing)
- [ ] Rate limiting on form uploads (prevent abuse)
- [ ] Shared exercise forms across coaches (community library)
- [ ] Video thumbnail storage (S3/GCS) for form recordings
- [ ] Webhook notifications to coach when client completes a form check

---

*Last updated: February 6, 2026*
