/** Ages the app accepts; the judge's strength standards don't go further. */
export const MIN_AGE = 10;
export const MAX_AGE = 100;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whole years from a birthday to a day, both yyyy-MM-dd. Someone born on
 * 29 February turns a year older on 1 March in non-leap years. Null for
 * anything that isn't a date.
 */
export function ageOn(birthDate: string, day: string): number | null {
  const b = ISO_DATE.exec(birthDate);
  const d = ISO_DATE.exec(day);
  if (!b || !d) return null;
  let age = Number(d[1]) - Number(b[1]);
  const beforeBirthday =
    Number(d[2]) < Number(b[2]) || (Number(d[2]) === Number(b[2]) && Number(d[3]) < Number(b[3]));
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * A lifter's age from whatever their profile has: the exact birthday, or
 * just the birth year that profiles made before birthdays were asked for.
 */
export function profileAge(
  profile: { birth_date?: string | null; birth_year?: number | null } | null | undefined,
  today: string,
): number | null {
  if (profile?.birth_date) return ageOn(profile.birth_date, today);
  if (profile?.birth_year) return Number(today.slice(0, 4)) - profile.birth_year;
  return null;
}

/** min/max for a birthday date input: between MAX_AGE and MIN_AGE years ago. */
export function birthdayBounds(today: string): { min: string; max: string } {
  const year = Number(today.slice(0, 4));
  // 29 February doesn't exist in most years; the day before always does.
  const monthDay = today.slice(4) === "-02-29" ? "-02-28" : today.slice(4);
  return { min: `${year - MAX_AGE}${monthDay}`, max: `${year - MIN_AGE}${monthDay}` };
}

/** Whether a yyyy-MM-dd birthday gives an age the app accepts, as of `today`. */
export function isAcceptedBirthday(birthDate: string, today: string): boolean {
  const age = ageOn(birthDate, today);
  return age !== null && age >= MIN_AGE && age <= MAX_AGE;
}
