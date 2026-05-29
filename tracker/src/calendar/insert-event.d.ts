import type { CalendarEvent } from './types';
export type InsertEventResult =
  | {
      ok: true;
      eventId: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };
export declare function insertEvent(
  payload: CalendarEvent,
  auth: {
    getValidAccessToken: () => Promise<string>;
  },
): Promise<InsertEventResult>;
//# sourceMappingURL=insert-event.d.ts.map
