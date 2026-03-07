import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateSupabaseUser } from '../middleware/auth.middleware';

import {
  CreateNotificationSchema,
  MarkNotificationReadSchema,
} from '../schemas/notification.schema';

import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
} from '../controllers/notification.controller';

const router = Router();

/**
 * @route   GET /notifications
 * @desc    Get user notifications
 * @access  Protected
 */
router.get('/', authenticateSupabaseUser, getUserNotifications);

/**
 * @route   POST /notifications
 * @desc    Create notification
 * @access  Protected
 */
router.post(
  '/',
  authenticateSupabaseUser,
  validateRequest(CreateNotificationSchema),
  createNotification
);

/**
 * @route   PATCH /notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Protected
 */
router.patch(
  '/:notificationId/read',
  authenticateSupabaseUser,
  validateRequest(MarkNotificationReadSchema),
  markNotificationAsRead
);

export default router;
