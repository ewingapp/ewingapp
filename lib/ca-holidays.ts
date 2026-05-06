// California state observed holidays. Used to highlight dates on the calendar.
// Dates are constructed in browser-local time so they line up with what the
// DayPicker treats as "the user's calendar day."

function nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(year, month0, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month0, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month0: number, weekday: number): Date {
  const last = new Date(year, month0 + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month0, last.getDate() - offset);
}

export function getCaHolidays(year: number): Date[] {
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // 4th Thursday of November
  const dayAfterThanksgiving = new Date(
    thanksgiving.getFullYear(),
    thanksgiving.getMonth(),
    thanksgiving.getDate() + 1,
  );
  return [
    new Date(year, 0, 1), // New Year's Day
    nthWeekdayOfMonth(year, 0, 1, 3), // MLK Day — 3rd Monday of January
    nthWeekdayOfMonth(year, 1, 1, 3), // Presidents' Day — 3rd Monday of February
    new Date(year, 2, 31), // Cesar Chavez Day
    lastWeekdayOfMonth(year, 4, 1), // Memorial Day — last Monday of May
    new Date(year, 5, 19), // Juneteenth
    new Date(year, 6, 4), // Independence Day
    nthWeekdayOfMonth(year, 8, 1, 1), // Labor Day — 1st Monday of September
    new Date(year, 10, 11), // Veterans Day
    thanksgiving,
    dayAfterThanksgiving,
    new Date(year, 11, 25), // Christmas
  ];
}

export function getCaHolidaysRange(yearsAhead: number = 2): Date[] {
  const thisYear = new Date().getFullYear();
  const out: Date[] = [];
  for (let y = thisYear - 1; y <= thisYear + yearsAhead; y++) {
    out.push(...getCaHolidays(y));
  }
  return out;
}
