import { z } from 'zod';

// ============== Shared Enums ==============

const CameraAngleEnum = z.enum([
  'FRONT',
  'SIDE_LEFT',
  'SIDE_RIGHT',
  'REAR',
  'ANGLE_45_LEFT',
  'ANGLE_45_RIGHT',
]);

// ============== Coach Form Endpoints ==============

export const UploadFormSchema = z.object({
  body: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
    cameraAngle: CameraAngleEnum,
    recorded_frames_key: z.string().min(1, 'Recorded frames key is required'),
  }),
});
export type UploadFormInput = z.infer<typeof UploadFormSchema>['body'];

export const UpdateFormSchema = z.object({
  params: z.object({
    formId: z.string().min(1, 'Form ID is required'),
  }),
  body: z.object({
    cameraAngle: CameraAngleEnum.optional(),
    recorded_frames_key: z.string().min(1).optional(),
  }),
});
export type UpdateFormInput = z.infer<typeof UpdateFormSchema>['body'];
export type UpdateFormParams = z.infer<typeof UpdateFormSchema>['params'];

export const GetExerciseFormsSchema = z.object({
  params: z.object({
    exerciseId: z.string().min(1, 'Exercise ID is required'),
  }),
});
export type GetExerciseFormsParams = z.infer<
  typeof GetExerciseFormsSchema
>['params'];

export const FormIdParamSchema = z.object({
  params: z.object({
    formId: z.string().min(1, 'Form ID is required'),
  }),
});
export type FormIdParams = z.infer<typeof FormIdParamSchema>['params'];

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
