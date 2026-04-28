import { z } from 'zod';
import { DAY_NAMES } from '../utils/days';

export const DayOfWeekSchema = z.enum(DAY_NAMES);

export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;
