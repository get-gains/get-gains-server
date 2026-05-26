import type { Request, Response } from 'express';
import { getFormLibrary } from '../services/form-library.service';
import { sendSuccess } from '../utils/response';
import { logger } from '../utils/logger';
import { UnauthorizedException } from '../lib/errors/exceptions';
import type { FormLibraryQuery } from '../schemas/form-library.schema';

const getSupabaseId = (req: Request): string | undefined => {
  const user = req.user;
  if (!user) return undefined;
  return 'supabase_auth_id' in user
    ? ((user as Record<string, unknown>).supabase_auth_id as string)
    : user.id;
};

/**
 * Get public exercises with form recordings for the Form Library.
 * Returns paginated, filterable, sortable list of exercises with
 * coach info, rating counts, and user's own rating status.
 */
export const getFormLibraryHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const supabaseId = getSupabaseId(req);
  if (!supabaseId) {
    throw new UnauthorizedException('UNAUTHENTICATED', 'Unauthorized');
  }

  const query = res.locals.validated?.query as FormLibraryQuery;

  logger.debug('Fetching form library', {
    search: query.search,
    muscleGroup: query.muscleGroup,
    sort: query.sort,
    limit: query.limit,
    offset: query.offset,
  });

  const result = await getFormLibrary(query, supabaseId);

  logger.info(`Fetched ${result.exercises.length} library exercises`);

  sendSuccess(res, {
    exercises: result.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      target_muscles: e.target_muscles,
      is_public: e.is_public,
      thumbs_up_count: e.thumbs_up_count,
      has_forms: e.has_forms,
      coach_name: e.coach_name,
      coach_avatar_url: e.coach_avatar_url,
      is_rated_by_user: e.is_rated_by_user ?? false,
      created_at: e.created_at,
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    hasMore: result.hasMore,
  });
};
