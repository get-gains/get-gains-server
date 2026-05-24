import { Router } from 'express';
import {
  authenticateSupabaseUser,
  requireAppUser,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  ListNotificationsSchema,
  MarkReadParamsSchema,
} from '../schemas/notification.schema';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller';

const router = Router();

router.use(authenticateSupabaseUser, requireAppUser);

router.get('/', validateRequest(ListNotificationsSchema), listNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch(
  '/:id/read',
  validateRequest(MarkReadParamsSchema),
  markNotificationRead
);
router.patch('/read-all', markAllNotificationsRead);

export default router;
