import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { listActiveMissionsForUser } from '../services/missions.service';

/**
 * GET /api/missions
 * Active missions (supported goal types, within date window) with user progress.
 */
export const listMissions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.appUser!.supabase_auth_id;
  const missions = await listActiveMissionsForUser(userId, prisma);
  sendSuccess(res, { missions });
};
