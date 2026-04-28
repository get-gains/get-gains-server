import { Router } from 'express';
import {
  authenticateSupabaseUser,
  requireAppUser,
  requireCoach,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  uploadCoachForm,
  getFormById,
  getExerciseForms,
  updateForm,
  deleteForm,
  bulkDownloadProgramForms,
  downloadExerciseForm,
  createFramesUploadUrl,
  getFormDownloadUrl,
} from '../controllers/pose.controller';
import {
  UploadFormSchema,
  UpdateFormSchema,
  GetExerciseFormsSchema,
  FormIdParamSchema,
  DownloadProgramFormsSchema,
  DownloadExerciseFormSchema,
  FramesUploadUrlSchema,
} from '../schemas/pose.schema';

const router = Router();

// ============== Coach Form Management ==============

router.post(
  '/forms',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UploadFormSchema),
  uploadCoachForm
);

router.get(
  '/forms/:formId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(FormIdParamSchema),
  getFormById
);

router.get(
  '/exercises/:exerciseId/forms',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(GetExerciseFormsSchema),
  getExerciseForms
);

router.put(
  '/forms/:formId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpdateFormSchema),
  updateForm
);

router.delete(
  '/forms/:formId',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(FormIdParamSchema),
  deleteForm
);

// ============== Offline Download ==============

router.get(
  '/download/program/:programId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DownloadProgramFormsSchema),
  bulkDownloadProgramForms
);

router.get(
  '/download/exercise/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(DownloadExerciseFormSchema),
  downloadExerciseForm
);

// ============== Presigned Upload / Download URLs ==============

router.post(
  '/uploads/frames-url',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(FramesUploadUrlSchema),
  createFramesUploadUrl
);

router.get(
  '/forms/:formId/download-url',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(FormIdParamSchema),
  getFormDownloadUrl
);

export default router;
