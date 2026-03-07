import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Create Notification
 */
export const createNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { title, message, type } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ message: 'Failed to create notification' });
  }
};

/**
 * Get Notifications for User
 */
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

/**
 * Mark Notification as Read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    const notification = await prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    res.json(notification);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
};
