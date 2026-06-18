import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { uploadGenericImageWithFields } from '../middleware/upload.middleware';
import {
  UploadAdminImageSchema,
  AdminImageUrlSchema,
} from '../schemas/admin-upload.schema';
import {
  uploadAdminImage,
  getAdminImageUrl,
} from '../controllers/admin-upload.controller';

const router = Router();

router.post(
  '/image',
  authenticateSupabaseUser,
  requireAdmin,
  uploadGenericImageWithFields,
  validateRequest(UploadAdminImageSchema),
  uploadAdminImage
);

router.get(
  '/image-url',
  authenticateSupabaseUser,
  requireAdmin,
  validateRequest(AdminImageUrlSchema),
  getAdminImageUrl
);

export default router;
