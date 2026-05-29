import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { validateActivity } from '../calendar/validation';
import { buildEventPayload } from '../calendar/build-payload';
import { insertEvent } from '../calendar/insert-event';
import type { ActivityInput } from '../calendar/types';
import { id } from '../i18n/id';

interface FormState {
  date: string;
  description: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  submitting: boolean;
}

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ActivityForm() {
  const { getValidAccessToken } = useAuth();

  const [form, setForm] = useState<FormState>({
    date: getLocalDateString(),
    description: '',
    allDay: true,
    startTime: '09:00',
    endTime: '17:00',
    submitting: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear related error on change
    if (name === 'description') {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.description;
        return next;
      });
    }
    if (name === 'startTime' || name === 'endTime') {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.time;
        return next;
      });
    }
  };

  const handleAllDayToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const allDay = e.target.checked;
    setForm((prev) => ({ ...prev, allDay }));
    // Clear time error when switching to all-day
    if (allDay) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.time;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmation(null);
    setSubmitError(null);

    // Build ActivityInput from form state
    const input: ActivityInput = form.allDay
      ? { date: form.date, description: form.description, allDay: true }
      : {
          date: form.date,
          description: form.description,
          allDay: false,
          startTime: form.startTime,
          endTime: form.endTime,
        };

    // Validate
    const result = validateActivity(input);
    if (!result.ok) {
      const newErrors: Record<string, string> = {};
      for (const err of result.errors) {
        if (err.field === 'description' && err.code === 'required') {
          newErrors.description = id.deskripsi_wajib;
        } else if (err.field === 'description' && err.code === 'too_long') {
          newErrors.description = id.deskripsi_terlalu_panjang;
        } else if (err.field === 'time' && err.code === 'end_before_or_equal_start') {
          newErrors.time = id.waktu_selesai;
        }
      }
      setErrors(newErrors);
      return;
    }

    // Submit
    setForm((prev) => ({ ...prev, submitting: true }));

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = buildEventPayload(input, tz);
    const insertResult = await insertEvent(payload, { getValidAccessToken });

    setForm((prev) => ({ ...prev, submitting: false }));

    if (insertResult.ok) {
      setConfirmation(`Aktivitas berhasil disimpan untuk tanggal ${form.date}`);
      // Clear description, keep date
      setForm((prev) => ({ ...prev, description: '' }));
      setErrors({});
    } else {
      setSubmitError(insertResult.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="activity-form" aria-label="Form aktivitas">
      {confirmation && (
        <div data-testid="confirmation" role="status">
          {confirmation}
        </div>
      )}

      {submitError && (
        <div data-testid="submit-error" role="alert">
          {submitError}
        </div>
      )}

      <div>
        <label htmlFor="activity-date">Tanggal</label>
        <input
          id="activity-date"
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
        />
      </div>

      <div>
        <label htmlFor="activity-description">Deskripsi</label>
        <textarea
          id="activity-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'desc-error' : undefined}
        />
        {errors.description && (
          <p id="desc-error" role="alert" data-testid="error-description">
            {errors.description}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="activity-allday">Seharian</label>
        <input
          id="activity-allday"
          type="checkbox"
          name="allDay"
          checked={form.allDay}
          onChange={handleAllDayToggle}
        />
      </div>

      {!form.allDay && (
        <>
          <div>
            <label htmlFor="activity-start-time">Waktu mulai</label>
            <input
              id="activity-start-time"
              type="time"
              name="startTime"
              value={form.startTime}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="activity-end-time">Waktu selesai</label>
            <input
              id="activity-end-time"
              type="time"
              name="endTime"
              value={form.endTime}
              onChange={handleChange}
              aria-invalid={!!errors.time}
              aria-describedby={errors.time ? 'time-error' : undefined}
            />
            {errors.time && (
              <p id="time-error" role="alert" data-testid="error-time">
                {errors.time}
              </p>
            )}
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={form.submitting}
        data-testid="submit-button"
      >
        {form.submitting ? 'Menyimpan…' : 'Simpan'}
      </button>
    </form>
  );
}
