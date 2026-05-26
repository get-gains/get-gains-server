import prisma from '../config/database';
import type { FormLibraryQuery } from '../schemas/form-library.schema';

interface LibraryExerciseResult {
  id: string;
  name: string;
  description: string;
  target_muscles: string[];
  is_public: boolean;
  thumbs_up_count: number;
  created_at: Date;
  has_forms: boolean;
  coach_name: string;
  coach_avatar_url: string | null;
  is_rated_by_user: boolean;
}

interface FormLibraryResult {
  exercises: LibraryExerciseResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Get public exercises with form recordings for the Form Library.
 * Filters to exercises that have at least one form recording and are public.
 */
export const getFormLibrary = async (
  query: FormLibraryQuery,
  currentUserId: string
): Promise<FormLibraryResult> => {
  const { search, muscleGroup, sort, limit, offset } = query;

  const whereConditions: string[] = ['e.is_public = true'];
  const params: unknown[] = [];

  whereConditions.push(
    `EXISTS (SELECT 1 FROM exercise_form ef WHERE ef.exercise_id = e.id)`
  );

  if (search) {
    params.push(`%${search}%`);
    whereConditions.push(
      `(e.name ILIKE $${params.length} OR e.description ILIKE $${params.length})`
    );
  }

  if (muscleGroup) {
    params.push(muscleGroup);
    whereConditions.push(`$${params.length} = ANY(e.target_muscles)`);
  }

  const whereParamCount = params.length;

  const whereClause = whereConditions.join(' AND ');

  const orderBy =
    sort === 'newest'
      ? 'e.created_at DESC'
      : 'e.thumbs_up_count DESC, e.created_at DESC';

  params.push(limit);
  const limitParam = params.length;
  params.push(offset);
  const offsetParam = params.length;

  const exercisesQuery = `
    SELECT
      e.id,
      e.name,
      e.description,
      e.target_muscles,
      e.is_public,
      e.thumbs_up_count,
      e.created_at,
      EXISTS (SELECT 1 FROM exercise_form ef WHERE ef.exercise_id = e.id) AS has_forms,
      u.full_name AS coach_name,
      u.avatar_key AS coach_avatar_url,
      CASE WHEN er.user_id IS NOT NULL THEN true ELSE false END AS is_rated_by_user
    FROM exercise e
    JOIN "user" u ON e.user_id = u.supabase_auth_id
    LEFT JOIN exercise_rating er ON e.id = er.exercise_id AND er.user_id = $${params.length + 1}
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
  `;

  params.push(currentUserId);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM exercise e
    WHERE ${whereClause}
  `;

  const [exercises, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<LibraryExerciseResult[]>(exercisesQuery, ...params),
    prisma.$queryRawUnsafe<{ total: bigint }[]>(
      countQuery,
      ...params.slice(0, whereParamCount)
    ),
  ]);

  const total = Number(countResult[0].total);

  return {
    exercises,
    total,
    limit,
    offset,
    hasMore: offset + exercises.length < total,
  };
};
