export type ActivityInput =
  | { date: string; description: string; allDay: true }
  | { date: string; description: string; allDay: false; startTime: string; endTime: string };

export type ValidationResult =
  | { ok: true; value: ActivityInput }
  | { ok: false; errors: ValidationError[] };

export type ValidationError =
  | { field: 'description'; code: 'required' | 'too_long' }
  | { field: 'time'; code: 'end_before_or_equal_start' };

export type CalendarEvent =
  | { summary: string; start: { date: string }; end: { date: string } }
  | { summary: string; start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } };
