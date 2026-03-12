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
} from '../controllers/pose.controller';
import {
  UploadFormSchema,
  UpdateFormSchema,
  GetExerciseFormsSchema,
  FormIdParamSchema,
  UpsertPoseConfigSchema,
  GetPoseConfigSchema,
  SubmitResultSchema,
  ResultHistorySchema,
  ResultIdParamSchema,
  ResultsByExerciseSchema,
  ResultsBySessionSchema,
  DownloadProgramFormsSchema,
  DownloadExerciseFormSchema,
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

router.patch(
  '/forms/:formId/activate',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(FormIdParamSchema),
  activateForm
);

// ============== Pose Config ==============

router.put(
  '/exercises/:exerciseId/config',
  authenticateSupabaseUser,
  requireCoach,
  validateRequest(UpsertPoseConfigSchema),
  upsertPoseConfig
);

router.get(
  '/exercises/:exerciseId/config',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(GetPoseConfigSchema),
  getPoseConfig
);

// ============== Client Results ==============

router.post(
  '/results',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(SubmitResultSchema),
  submitClientResult
);

router.get(
  '/results',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ResultHistorySchema),
  getClientHistory
);

router.get(
  '/results/:resultId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ResultIdParamSchema),
  getResultById
);

router.get(
  '/results/exercise/:exerciseId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ResultsByExerciseSchema),
  getResultsByExercise
);

router.get(
  '/results/session/:sessionId',
  authenticateSupabaseUser,
  requireAppUser,
  validateRequest(ResultsBySessionSchema),
  getResultsBySession
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

export default router;
