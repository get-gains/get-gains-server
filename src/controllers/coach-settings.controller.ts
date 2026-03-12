import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { UpdateCoachSettingsInput } from '../schemas/coach-settings.schema';

/**
 * Get coach's own settings
 * GET /api/coach/settings
 */
export const getCoachSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    // Upsert ensures settings always exist (idempotent default seeding)
    const settings = await prisma.coachSettings.upsert({
      where: { coachId: coach.id },
      create: { coachId: coach.id },
      update: {},
    });

    sendSuccess(res, { settings });
  } catch (error) {
    const err = error as Error;
    logger.error('Error fetching coach settings', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to fetch coach settings', 500);
  }
};

/**
 * Update coach's own settings
 * PATCH /api/coach/settings
 */
export const updateCoachSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const coach = req.coach;
    if (!coach) {
      sendSingleError(res, 'Coach required', 403);
      return;
    }

    const body = req.body as UpdateCoachSettingsInput;

    const data: {
      maxClients?: number;
      acceptingClients?: boolean;
      isDiscoverable?: boolean;
    } = {};

    if (body.maxClients !== undefined) data.maxClients = body.maxClients;
    if (body.acceptingClients !== undefined)
      data.acceptingClients = body.acceptingClients;
    if (body.isDiscoverable !== undefined)
      data.isDiscoverable = body.isDiscoverable;

    // Upsert: create with defaults if missing, then apply the patch
    const settings = await prisma.coachSettings.upsert({
      where: { coachId: coach.id },
      create: { coachId: coach.id, ...data },
      update: data,
    });

    logger.info('Coach settings updated', { coachId: coach.id, changes: data });

    sendSuccess(res, { settings });
  } catch (error) {
    const err = error as Error;
    logger.error('Error updating coach settings', {
      message: err.message,
      stack: err.stack,
    });
    sendSingleError(res, 'Failed to update coach settings', 500);
  }
};
