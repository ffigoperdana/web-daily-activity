import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { validateActivity } from '../calendar/validation';
import { buildEventPayload } from '../calendar/build-payload';
import { insertEvent } from '../calendar/insert-event';
import { id } from '../i18n/id';
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
export function ActivityForm() {
  const { getValidAccessToken } = useAuth();
  const [form, setForm] = useState({
    date: getLocalDateString(),
    description: '',
    allDay: true,
    startTime: '09:00',
    endTime: '17:00',
    submitting: false,
  });
  const [errors, setErrors] = useState({});
  const [confirmation, setConfirmation] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
  const handleAllDayToggle = (e) => {
    const allDay = e.target.checked;
    setForm((prev) => ({ ...prev, allDay }));
    if (allDay) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.time;
        return next;
      });
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setConfirmation(null);
    setSubmitError(null);
    const input = form.allDay
      ? { date: form.date, description: form.description, allDay: true }
      : {
          date: form.date,
          description: form.description,
          allDay: false,
          startTime: form.startTime,
          endTime: form.endTime,
        };
    const result = validateActivity(input);
    if (!result.ok) {
      const newErrors = {};
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
    setForm((prev) => ({ ...prev, submitting: true }));
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = buildEventPayload(input, tz);
    const insertResult = await insertEvent(payload, { getValidAccessToken });
    setForm((prev) => ({ ...prev, submitting: false }));
    if (insertResult.ok) {
      setConfirmation(`Aktivitas berhasil disimpan untuk tanggal ${form.date}`);
      setForm((prev) => ({ ...prev, description: '' }));
      setErrors({});
    } else {
      setSubmitError(insertResult.message);
    }
  };
  return _jsx('div', {
    className: 'card',
    children: _jsxs('form', {
      onSubmit: handleSubmit,
      'data-testid': 'activity-form',
      'aria-label': 'Form aktivitas',
      children: [
        confirmation &&
          _jsx('div', {
            className: 'alert alert-success',
            'data-testid': 'confirmation',
            role: 'status',
            children: confirmation,
          }),
        submitError &&
          _jsx('div', {
            className: 'alert alert-error',
            'data-testid': 'submit-error',
            role: 'alert',
            children: submitError,
          }),
        _jsxs('div', {
          className: 'form-group',
          children: [
            _jsx('label', {
              htmlFor: 'activity-date',
              className: 'form-label',
              children: 'Tanggal',
            }),
            _jsx('input', {
              id: 'activity-date',
              className: 'form-input',
              type: 'date',
              name: 'date',
              value: form.date,
              onChange: handleChange,
            }),
          ],
        }),
        _jsxs('div', {
          className: 'form-group',
          children: [
            _jsx('label', {
              htmlFor: 'activity-description',
              className: 'form-label',
              children: 'Deskripsi',
            }),
            _jsx('textarea', {
              id: 'activity-description',
              className: 'form-textarea',
              name: 'description',
              value: form.description,
              onChange: handleChange,
              placeholder: 'Apa yang kamu kerjakan hari ini?',
              'aria-invalid': !!errors.description,
              'aria-describedby': errors.description ? 'desc-error' : undefined,
            }),
            errors.description &&
              _jsx('p', {
                id: 'desc-error',
                className: 'form-error',
                role: 'alert',
                'data-testid': 'error-description',
                children: errors.description,
              }),
          ],
        }),
        _jsxs('div', {
          className: 'form-check',
          children: [
            _jsx('input', {
              id: 'activity-allday',
              type: 'checkbox',
              name: 'allDay',
              checked: form.allDay,
              onChange: handleAllDayToggle,
            }),
            _jsx('label', { htmlFor: 'activity-allday', children: 'Seharian' }),
          ],
        }),
        !form.allDay &&
          _jsxs('div', {
            className: 'time-row',
            children: [
              _jsxs('div', {
                className: 'form-group',
                children: [
                  _jsx('label', {
                    htmlFor: 'activity-start-time',
                    className: 'form-label',
                    children: 'Waktu mulai',
                  }),
                  _jsx('input', {
                    id: 'activity-start-time',
                    className: 'form-input',
                    type: 'time',
                    name: 'startTime',
                    value: form.startTime,
                    onChange: handleChange,
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'form-group',
                children: [
                  _jsx('label', {
                    htmlFor: 'activity-end-time',
                    className: 'form-label',
                    children: 'Waktu selesai',
                  }),
                  _jsx('input', {
                    id: 'activity-end-time',
                    className: 'form-input',
                    type: 'time',
                    name: 'endTime',
                    value: form.endTime,
                    onChange: handleChange,
                    'aria-invalid': !!errors.time,
                    'aria-describedby': errors.time ? 'time-error' : undefined,
                  }),
                  errors.time &&
                    _jsx('p', {
                      id: 'time-error',
                      className: 'form-error',
                      role: 'alert',
                      'data-testid': 'error-time',
                      children: errors.time,
                    }),
                ],
              }),
            ],
          }),
        _jsx('button', {
          type: 'submit',
          className: 'btn btn-primary',
          disabled: form.submitting,
          'data-testid': 'submit-button',
          children: form.submitting ? 'Menyimpan…' : 'Simpan ke Calendar',
        }),
      ],
    }),
  });
}
//# sourceMappingURL=ActivityForm.js.map
