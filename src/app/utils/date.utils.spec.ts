import { daysFromToday, isoDate } from './date.utils';

describe('date utilities', () => {
  it('normalizes strings, dates, and Firestore-style timestamps', () => {
    expect(isoDate('2026-08-06T10:30:00Z')).toBe('2026-08-06');
    expect(isoDate(new Date('2026-08-06T10:30:00Z'))).toBe('2026-08-06');
    expect(isoDate({ toDate: () => new Date('2026-08-06T10:30:00Z') })).toBe('2026-08-06');
  });

  it('returns a date relative to the supplied day', () => {
    expect(daysFromToday(5, new Date('2026-08-06T10:00:00Z'))).toBe('2026-08-11');
  });
});
