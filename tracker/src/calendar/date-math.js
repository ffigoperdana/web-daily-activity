/**
 * Increment a YYYY-MM-DD date string by one day in the proleptic Gregorian calendar.
 * Uses UTC Date methods to avoid timezone pitfalls.
 */
export function addOneDay(date) {
  const [yearStr, monthStr, dayStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  // Use UTC to avoid any timezone offset issues
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
//# sourceMappingURL=date-math.js.map
