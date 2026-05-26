import type { notification } from '@prisma/client';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Create a notification for a user.
 */
export const createNotification = async (params: {
  userId: string;
  type: notification['type'];
  title: string;
  body: string;
  data?: Prisma.JsonValue;
}): Promise<notification> => {
  const notif = await prisma.notification.create({
    data: {
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data ?? Prisma.JsonNull,
    },
  });

  logger.debug('Notification created', {
    id: notif.id,
    userId: params.userId,
    type: params.type,
  });

  return notif;
};

/**
 * Fetch notifications for a user with optional filters and pagination.
 */
export const getNotifications = async (params: {
  userId: string;
  limit: number;
  offset: number;
  unreadOnly: boolean;
  after?: string;
}): Promise<{
  notifications: notification[];
  total: number;
  unreadCount: number;
}> => {
  const where: Prisma.notificationWhereInput = {
    user_id: params.userId,
    ...(params.unreadOnly && { is_read: false }),
    ...(params.after && {
      created_at: { gt: new Date(params.after) },
    }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: params.limit,
      skip: params.offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { user_id: params.userId, is_read: false },
    }),
  ]);

  return { notifications, total, unreadCount };
};

/**
 * Get the unread notification count for a user.
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({
    where: { user_id: userId, is_read: false },
  });
};

/**
 * Mark a single notification as read.
 */
export const markAsRead = async (
  notificationId: string,
  userId: string
): Promise<notification | null> => {
  const notif = await prisma.notification.findFirst({
    where: { id: notificationId, user_id: userId },
  });

  if (!notif) return null;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { is_read: true, read_at: new Date() },
  });
};

/**
 * Mark all notifications as read for a user.
 */
export const markAllAsRead = async (userId: string): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true, read_at: new Date() },
  });

  return result.count;
};

/**
 * Check if the user's subscription is expiring within the next 7, 3, or 1 days
 * and create appropriate notifications if not already created recently.
 */
export const checkSubscriptionExpiry = async (
  userId: string
): Promise<notification | null> => {
  const subscription = await prisma.user_subscription.findUnique({
    where: { user_id: userId },
    select: {
      current_period_end: true,
      status: true,
    },
  });

  if (!subscription || subscription.status !== 'ACTIVE') {
    return null;
  }

  const now = new Date();
  const daysRemaining = Math.ceil(
    (subscription.current_period_end.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (![7, 3, 1].includes(daysRemaining)) return null;

  const existing = await prisma.notification.findFirst({
    where: {
      user_id: userId,
      type: 'subscription_expiring',
      created_at: {
        gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    },
  });

  if (existing) return null;

  return createNotification({
    userId,
    type: 'subscription_expiring',
    title: 'Subscription Expiring Soon',
    body: `Your subscription expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}. Renew to keep access.`,
    data: { daysRemaining },
  });
};
