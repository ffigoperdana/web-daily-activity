import { describe, it, expect } from 'vitest';
import { validateActivity } from './validation';
import type { ActivityInput } from './types';

describe('validateActivity', () => {
  it('returns ok:true for a valid all-day activity', () => {
    const input: ActivityInput = { date: '2025-01-15', description: 'Work day', allDay: true };
    const result = validateActivity(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('returns ok:true for a valid timed activity', () => {
    const input: ActivityInput = {
      date: '2025-01-15',
      description: 'Meeting',
      allDay: false,
      startTime: '09:00',
      endTime: '10:00',
    };
    const result = validateActivity(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('returns description required error when description is empty', () => {
    const input: ActivityInput = { date: '2025-01-15', description: '', allDay: true };
    const result = validateActivity(input);
    expect(result).toEqual({ ok: false, errors: [{ field: 'description', code: 'required' }] });
  });

  it('returns description required error when description is only whitespace', () => {
    const input: ActivityInput = { date: '2025-01-15', description: '   \t\n  ', allDay: true };
    const result = validateActivity(input);
    expect(result).toEqual({ ok: false, errors: [{ field: 'description', code: 'required' }] });
  });

  it('returns too_long error when trimmed description exceeds 1024 characters', () => {
    const input: ActivityInput = {
      date: '2025-01-15',
      description: 'a'.repeat(1025),
      allDay: true,
    };
    const result = validateActivity(input);
    expect(result).toEqual({ ok: false, errors: [{ field: 'description', code: 'too_long' }] });
  });

  it('accepts description of exactly 1024 characters', () => {
    const input: ActivityInput = {
      date: '2025-01-15',
      description: 'a'.repeat(1024),
      allDay: true,
    };
    const result = validateActivity(input);
    expect(result).toEqual({ ok: true, value: input });
  });

  it('returns time error when endTime equals startTime', () => {
    const input: ActivityInput = {
      date: '2025-01-15',
      description: 'Meeting',
      allDay: false,
      startTime: '09:00',
      endTime: '09:00',
    };
    const result = validateActivity(input);
    expect(result).toEqual({
      ok: false,
      errors: [{ field: 'time', code: 'end_before_or_equal_start' }],
    });
  });

  it('returns time error when endTime is before startTime', () => {
    const input: ActivityInput = {
      date: '2025-01-15',
      description: 'Meeting',
      allDay: false,
      startTime: '14:00',
      endTime: '09:00',
    };
    const result = validateActivity(input);
    expect(result).toEqual({
      ok: false,
      errors: [{ field: 'time', code: 'end_before_or_equal_start' }],
    });
  });

  it('returns multiple errors simultaneously', () => {
    const input: ActivityInput = {
      date: '2025-01-15',
      description: '',
      allDay: false,
      startTime: '14:00',
      endTime: '09:00',
    };
    const result = validateActivity(input);
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: 'description', code: 'required' },
        { field: 'time', code: 'end_before_or_equal_start' },
      ],
    });
  });

  it('does not check time for all-day activities', () => {
    const input: ActivityInput = { date: '2025-01-15', description: 'Work', allDay: true };
    const result = validateActivity(input);
    expect(result).toEqual({ ok: true, value: input });
  });
});
