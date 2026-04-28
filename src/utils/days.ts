export const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export const DAY_SHORT_NAMES = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
] as const;

export type DayName = (typeof DAY_NAMES)[number];
export type DayShortName = (typeof DAY_SHORT_NAMES)[number];

export const resolveToday = (): {
  dayName: DayName;
  dayShortName: DayShortName;
  dayNumber: number;
} => {
  const utcDay = new Date().getUTCDay(); // 0=Sunday ... 6=Saturday

  return {
    dayName: DAY_NAMES[utcDay],
    dayShortName: DAY_SHORT_NAMES[utcDay],
    dayNumber: utcDay === 0 ? 7 : utcDay, // Monday=1 ... Sunday=7
  };
};

export const isScheduledToday = (daysOfWeek: string[]): boolean => {
  const { dayName } = resolveToday();
  return daysOfWeek.includes(dayName);
};
