// US Federal Holidays for 2025 and 2026
// Format: MM-DD (for repeating yearly) or YYYY-MM-DD (for fixed dates)
export const US_FEDERAL_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': "New Year's Day",
  '2025-01-20': 'MLK Day',
  '2025-02-17': "Presidents' Day",
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-10-13': 'Columbus Day',
  '2025-11-11': 'Veterans Day',
  '2025-11-27': 'Thanksgiving',
  '2025-12-25': 'Christmas Day',
  // 2026
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'MLK Day',
  '2026-02-16': "Presidents' Day",
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-04': 'Independence Day',
  '2026-09-07': 'Labor Day',
  '2026-10-12': 'Columbus Day',
  '2026-11-11': 'Veterans Day',
  '2026-11-26': 'Thanksgiving',
  '2026-12-25': 'Christmas Day',
};

export function getHoliday(dateStr: string): string | null {
  return US_FEDERAL_HOLIDAYS[dateStr] ?? null;
}
