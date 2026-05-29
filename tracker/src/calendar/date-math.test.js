import { describe, it, expect } from 'vitest';
import { addOneDay } from './date-math';
describe('addOneDay', () => {
  it('handles a regular day', () => {
    expect(addOneDay('2025-01-15')).toBe('2025-01-16');
  });
  it('handles month-end rollover (31-day month)', () => {
    expect(addOneDay('2025-01-31')).toBe('2025-02-01');
  });
  it('handles month-end rollover (30-day month)', () => {
    expect(addOneDay('2025-04-30')).toBe('2025-05-01');
  });
  it('handles year-end rollover', () => {
    expect(addOneDay('2025-12-31')).toBe('2026-01-01');
  });
  it('handles leap year Feb 28 → Feb 29', () => {
    expect(addOneDay('2024-02-28')).toBe('2024-02-29');
  });
  it('handles leap year Feb 29 → Mar 01', () => {
    expect(addOneDay('2024-02-29')).toBe('2024-03-01');
  });
  it('handles non-leap year Feb 28 → Mar 01', () => {
    expect(addOneDay('2025-02-28')).toBe('2025-03-01');
  });
  it('returns zero-padded month and day', () => {
    const result = addOneDay('2025-01-01');
    expect(result).toBe('2025-01-02');
    // Verify format: YYYY-MM-DD with zero-padding
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
//# sourceMappingURL=date-math.test.js.map
