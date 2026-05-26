import { Request, Response } from 'express';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  checkSubscriptionExpiry,
} from '../services/notification.service';
import type {
  ListNotificationsQuery,
  MarkReadParams,
} from '../schemas/notification.schema';

/**
 * List notifications for the authenticated user.
 * GET /api/notifications
 */
export const listNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    sendSingleError(res, 'Authentication required', 401);
    return;
  }

  const { limit, offset, unreadOnly, after } = res.locals.validated
    ?.query as ListNotificationsQuery;

  const result = await getNotifications({
    userId: appUser.supabase_auth_id,
    limit,
    offset,
    unreadOnly,
    after,
  });

  sendSuccess(res, {
    notifications: result.notifications,
    total: result.total,
    unreadCount: result.unreadCount,
  });
};

/**
 * Get the unread notification count.
 * GET /api/notifications/unread-count
 */
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    sendSingleError(res, 'Authentication required', 401);
    return;
  }

  // Check subscription expiry on every poll
  await checkSubscriptionExpiry(appUser.supabase_auth_id);

  const count = await getUnreadCount(appUser.supabase_auth_id);
  sendSuccess(res, { count });
};

/**
 * Mark a single notification as read.
 * PATCH /api/notifications/:id/read
 */
export const markNotificationRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    sendSingleError(res, 'Authentication required', 401);
    return;
  }

  const { id } = res.locals.validated?.params as MarkReadParams;

  const updated = await markAsRead(id, appUser.supabase_auth_id);
  if (!updated) {
    sendSingleError(res, 'Notification not found', 404);
    return;
  }

  sendSuccess(res, { notification: updated });
};

/**
 * Mark all notifications as read.
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  const appUser = req.appUser;
  if (!appUser) {
    sendSingleError(res, 'Authentication required', 401);
    return;
  }

  const count = await markAllAsRead(appUser.supabase_auth_id);
  sendSuccess(res, { count });
};
