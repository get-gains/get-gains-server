import { z } from 'zod';

// ============== Shared Enums ==============

const BodySegmentEnum = z.enum([
  'HEAD_NECK',
  'LEFT_ARM',
  'RIGHT_ARM',
  'TORSO',
  'LEFT_LEG',
  'RIGHT_LEG',
  'FULL_BODY',
]);

const CameraAngleEnum = z.enum([
  'FRONT',
  'SIDE_LEFT',
  'SIDE_RIGHT',
  'REAR',
  'ANGLE_45_LEFT',
  'ANGLE_45_RIGHT',
]);

// ============== Shared Landmark / Feature Structures ==============

/// Raw landmark coordinates are normalised by dividing pixel position by image
/// dimensions, so values are *usually* 0-1.  However, MLKit can report
/// landmark positions outside the visible frame (e.g. a wrist extending past
/// the edge of the camera), producing values like -0.1 or 1.2.  Additionally,
/// on Android the camera sensor is landscape while the phone is held portrait;
/// MLKit returns coordinates in the rotated space which, when divided by the
/// un-rotated sensor dimension, can exceed 1.0 significantly (e.g. y up to
/// ~1.78 for 1920/1080).  We therefore use a wide margin.
const LandmarkSchema = z.object({
  x: z.number().min(-1.0).max(3.0),
  y: z.number().min(-1.0).max(3.0),
  z: z.number(),
  confidence: z.number().min(0).max(1),
});

/// Normalized landmarks use Procrustes alignment (centered at origin),
/// so x/y values range from roughly -1 to +1.
const NormalizedLandmarkSchema = z.object({
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
  z: z.number(),
  confidence: z.number().min(0).max(1),
});

const LandmarkFrameSchema = z.object({
  timestampMs: z.number().int().min(0),
  landmarks: z.record(z.string(), LandmarkSchema),
});

const NormalizedLandmarkFrameSchema = z.object({
  timestampMs: z.number().int().min(0),
  landmarks: z.record(z.string(), NormalizedLandmarkSchema),
});

const FeatureFrameSchema = z.object({
  timestampMs: z.number().int().min(0),
  angles: z.record(z.string(), z.number()).optional(),
  distances: z.record(z.string(), z.number()).optional(),
});

const TrackedAngleSchema = z.object({
  name: z.string().min(1),
  landmarks: z.array(z.string()).min(2),
  idealMin: z.number(),
  idealMax: z.number(),
});

// ============== Coach Form Endpoints ==============

export const UploadFormSchema = z.object({
  body: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
    cameraAngle: CameraAngleEnum,
    durationMs: z.number().int().positive(),
    frameRate: z
      .number()
      .int()
      .min(30, 'Minimum 30 FPS required for accurate DTW analysis')
      .max(60),
    totalFrames: z.number().int().positive(),
    landmarkFrames: z.array(LandmarkFrameSchema).min(1),
    featureFrames: z.array(FeatureFrameSchema).min(1),
    normalizedFrames: z.array(NormalizedLandmarkFrameSchema).nullish(),
    relevantAngles: z.array(z.string().min(1)).nullish(),
    avgLandmarkConfidence: z.number().min(0).max(1).optional(),
    recordingQuality: z.enum(['good', 'acceptable', 'poor']).optional(),
  }),
});
export type UploadFormInput = z.infer<typeof UploadFormSchema>['body'];

export const UpdateFormSchema = z.object({
  params: z.object({
    formId: z.string().min(1, 'Form ID is required'),
  }),
  body: z.object({
    cameraAngle: CameraAngleEnum.optional(),
    durationMs: z.number().int().positive().optional(),
    frameRate: z
      .number()
      .int()
      .min(30, 'Minimum 30 FPS required for accurate DTW analysis')
      .max(60)
      .optional(),
    totalFrames: z.number().int().positive().optional(),
    landmarkFrames: z.array(LandmarkFrameSchema).min(1).optional(),
    featureFrames: z.array(FeatureFrameSchema).min(1).optional(),
    normalizedFrames: z.array(NormalizedLandmarkFrameSchema).nullish(),
    relevantAngles: z.array(z.string().min(1)).nullish(),
    avgLandmarkConfidence: z.number().min(0).max(1).optional(),
    recordingQuality: z.enum(['good', 'acceptable', 'poor']).optional(),
  }),
});
export type UpdateFormInput = z.infer<typeof UpdateFormSchema>['body'];
export type UpdateFormParams = z.infer<typeof UpdateFormSchema>['params'];

export const GetExerciseFormsSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
  query: z.object({
    activeOnly: z.coerce.boolean().optional().default(false),
  }),
});
export type GetExerciseFormsParams = z.infer<
  typeof GetExerciseFormsSchema
>['params'];
export type GetExerciseFormsQuery = z.infer<
  typeof GetExerciseFormsSchema
>['query'];

export const FormIdParamSchema = z.object({
  params: z.object({
    formId: z.string().min(1, 'Form ID is required'),
  }),
});
export type FormIdParams = z.infer<typeof FormIdParamSchema>['params'];

// ============== Pose Config Endpoints ==============

export const UpsertPoseConfigSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
  body: z.object({
    activeSegments: z.array(BodySegmentEnum).min(1),
    recommendedAngles: z.array(CameraAngleEnum).min(1),
    trackedAngles: z.array(TrackedAngleSchema).min(1),
    minLandmarkConfidence: z.number().min(0).max(1).optional().default(0.5),
    setupInstructions: z.string().max(2000).optional(),
  }),
});
export type UpsertPoseConfigParams = z.infer<
  typeof UpsertPoseConfigSchema
>['params'];
export type UpsertPoseConfigInput = z.infer<
  typeof UpsertPoseConfigSchema
>['body'];

export const GetPoseConfigSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
});
export type GetPoseConfigParams = z.infer<typeof GetPoseConfigSchema>['params'];

// ============== Client Result Endpoints ==============

const CorrectionSchema = z.object({
  angleName: z.string(),
  segment: BodySegmentEnum,
  avgDeviation: z.number(),
  maxDeviation: z.number(),
  direction: z.string(),
  message: z.string(),
});

export const SubmitResultSchema = z.object({
  body: z.object({
    exerciseFormId: z.string().min(1, 'Exercise form ID is required'),
    workoutSessionId: z.string().optional(),
    routineExerciseId: z.string().optional(),
    overallScore: z.number().min(0).max(1),
    segmentScores: z.record(BodySegmentEnum, z.number().min(0).max(1)),
    corrections: z.array(CorrectionSchema),
    cameraAngle: CameraAngleEnum,
    durationMs: z.number().int().positive(),
    frameRate: z
      .number()
      .int()
      .min(30, 'Minimum 30 FPS required for accurate DTW analysis')
      .max(60),
    totalFrames: z.number().int().positive(),
    avgLandmarkConfidence: z.number().min(0).max(1).optional(),
    clientLandmarkFrames: z.array(LandmarkFrameSchema).nullish(),
    clientFeatureFrames: z.array(FeatureFrameSchema).nullish(),
  }),
});
export type SubmitResultInput = z.infer<typeof SubmitResultSchema>['body'];

export const ResultHistorySchema = z.object({
  query: z.object({
    exerciseId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
});
export type ResultHistoryQuery = z.infer<typeof ResultHistorySchema>['query'];

export const ResultIdParamSchema = z.object({
  params: z.object({
    resultId: z.string().min(1, 'Result ID is required'),
  }),
});
export type ResultIdParams = z.infer<typeof ResultIdParamSchema>['params'];

export const ResultsByExerciseSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});
export type ResultsByExerciseParams = z.infer<
  typeof ResultsByExerciseSchema
>['params'];
export type ResultsByExerciseQuery = z.infer<
  typeof ResultsByExerciseSchema
>['query'];

export const ResultsBySessionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
});
export type ResultsBySessionParams = z.infer<
  typeof ResultsBySessionSchema
>['params'];

// ============== Download Endpoints ==============

export const DownloadProgramFormsSchema = z.object({
  params: z.object({
    programId: z.string().min(1, 'Program ID is required'),
  }),
  query: z.object({
    since: z.coerce.date().optional(),
  }),
});
export type DownloadProgramFormsParams = z.infer<
  typeof DownloadProgramFormsSchema
>['params'];
export type DownloadProgramFormsQuery = z.infer<
  typeof DownloadProgramFormsSchema
>['query'];

export const DownloadExerciseFormSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
});
export type DownloadExerciseFormParams = z.infer<
  typeof DownloadExerciseFormSchema
>['params'];
