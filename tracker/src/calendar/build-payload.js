import { addOneDay } from './date-math';
/**
 * Convert validated form input + IANA timezone into a Google Calendar event payload.
 */
export function buildEventPayload(input, tz) {
  const summary = input.description.trim();
  if (input.allDay) {
    return {
      summary,
      start: { date: input.date },
      end: { date: addOneDay(input.date) },
    };
  }
  return {
    summary,
    start: { dateTime: `${input.date}T${input.startTime}:00`, timeZone: tz },
    end: { dateTime: `${input.date}T${input.endTime}:00`, timeZone: tz },
  };
}
//# sourceMappingURL=build-payload.js.map
