import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  CreateCosmeticSchema,
  UpdateCosmeticSchema,
  CosmeticIdParamsSchema,
  ListCosmeticsQuerySchema,
} from '../schemas/admin-cosmetics.schema';
import {
  listCosmetics,
  createCosmetic,
  getCosmetic,
  updateCosmetic,
  deleteCosmetic,
} from '../controllers/admin-cosmetics.controller';

const router = Router();

router.use(authenticateSupabaseUser, requireAdmin);

router.get('/', validateRequest(ListCosmeticsQuerySchema), listCosmetics);
router.post('/', validateRequest(CreateCosmeticSchema), createCosmetic);
router.get('/:id', validateRequest(CosmeticIdParamsSchema), getCosmetic);
router.patch('/:id', validateRequest(UpdateCosmeticSchema), updateCosmetic);
router.delete('/:id', validateRequest(CosmeticIdParamsSchema), deleteCosmetic);

export default router;
