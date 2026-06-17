import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { uploadGenericImage } from '../middleware/upload.middleware';
import { UploadAdminImageSchema } from '../schemas/admin-upload.schema';
import { uploadAdminImage } from '../controllers/admin-upload.controller';

const router = Router();

router.post(
  '/image',
  authenticateSupabaseUser,
  requireAdmin,
  uploadGenericImage,
  validateRequest(UploadAdminImageSchema),
  uploadAdminImage
);

export default router;
