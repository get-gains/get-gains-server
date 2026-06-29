import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import {
  requireAdmin,
  requireAdminScope,
} from '../middleware/admin.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  CreatePartnerSchema,
  UpdatePartnerSchema,
  PartnerIdParamsSchema,
  ListPartnersQuerySchema,
} from '../schemas/admin-partners.schema';
import {
  listPartners,
  createPartner,
  getPartner,
  updatePartner,
  deletePartner,
} from '../controllers/admin-partners.controller';

const router = Router();

router.use(
  authenticateSupabaseUser,
  requireAdmin,
  requireAdminScope('manage_partners')
);

router.get('/', validateRequest(ListPartnersQuerySchema), listPartners);
router.post('/', validateRequest(CreatePartnerSchema), createPartner);
router.get('/:id', validateRequest(PartnerIdParamsSchema), getPartner);
router.patch('/:id', validateRequest(UpdatePartnerSchema), updatePartner);
router.delete('/:id', validateRequest(PartnerIdParamsSchema), deletePartner);

export default router;
