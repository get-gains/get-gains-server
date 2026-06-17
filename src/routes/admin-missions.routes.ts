import { Router } from 'express';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  CreateMissionSchema,
  UpdateMissionSchema,
  MissionIdParamsSchema,
  ListMissionsQuerySchema,
  DrawWinnersSchema,
} from '../schemas/admin-missions.schema';
import {
  listMissions,
  createMission,
  getMission,
  updateMission,
  deleteMission,
  drawWinners,
} from '../controllers/admin-missions.controller';

const router = Router();

router.use(authenticateSupabaseUser, requireAdmin);

router.get('/', validateRequest(ListMissionsQuerySchema), listMissions);
router.post('/', validateRequest(CreateMissionSchema), createMission);
router.get('/:id', validateRequest(MissionIdParamsSchema), getMission);
router.patch('/:id', validateRequest(UpdateMissionSchema), updateMission);
router.delete('/:id', validateRequest(MissionIdParamsSchema), deleteMission);
router.post(
  '/:id/draw-winners',
  validateRequest(DrawWinnersSchema),
  drawWinners
);

export default router;
