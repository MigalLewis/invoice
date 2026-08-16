export function isoDate(value: unknown = new Date()): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate().toISOString().slice(0, 10);
  }
  return new Date(value as string | number | Date).toISOString().slice(0, 10);
}

export function daysFromToday(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}
