import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityForm } from './ActivityForm';
import type { AuthContextValue } from '../auth/AuthContext';

// Mock useAuth
const mockAuth: AuthContextValue = {
  status: 'signed-in',
  email: 'owner@example.com',
  signIn: vi.fn(),
  signOut: vi.fn(),
  getValidAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
  retryInit: vi.fn(),
};

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Mock insertEvent
const mockInsertEvent = vi.fn();
vi.mock('../calendar/insert-event', () => ({
  insertEvent: (...args: unknown[]) => mockInsertEvent(...args),
}));

describe('ActivityForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getValidAccessToken = vi.fn().mockResolvedValue('mock-access-token');
    mockInsertEvent.mockResolvedValue({ ok: true, eventId: 'evt-123' });
  });

  it('renders the form with date pre-filled to today', () => {
    render(<ActivityForm />);
    const dateInput = screen.getByLabelText('Tanggal') as HTMLInputElement;
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(dateInput.value).toBe(expected);
  });

  it('renders description textarea, all-day toggle, and submit button', () => {
    render(<ActivityForm />);
    expect(screen.getByLabelText('Deskripsi')).toBeInTheDocument();
    expect(screen.getByLabelText('Seharian')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
  });

  it('hides time inputs when all-day is checked (default)', () => {
    render(<ActivityForm />);
    expect(screen.queryByLabelText('Waktu mulai')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Waktu selesai')).not.toBeInTheDocument();
  });

  it('shows time inputs when all-day is unchecked', () => {
    render(<ActivityForm />);
    const allDayCheckbox = screen.getByLabelText('Seharian');
    fireEvent.click(allDayCheckbox);
    expect(screen.getByLabelText('Waktu mulai')).toBeInTheDocument();
    expect(screen.getByLabelText('Waktu selesai')).toBeInTheDocument();
  });

  it('shows validation error when description is empty on submit', async () => {
    render(<ActivityForm />);
    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => {
      expect(screen.getByTestId('error-description')).toHaveTextContent(
        'deskripsi aktivitas wajib diisi',
      );
    });
    expect(mockInsertEvent).not.toHaveBeenCalled();
  });

  it('shows validation error when description exceeds 1024 characters', async () => {
    render(<ActivityForm />);
    const textarea = screen.getByLabelText('Deskripsi');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(1025) } });
    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => {
      expect(screen.getByTestId('error-description')).toHaveTextContent(
        'deskripsi terlalu panjang',
      );
    });
    expect(mockInsertEvent).not.toHaveBeenCalled();
  });

  it('shows time validation error when end time <= start time', async () => {
    render(<ActivityForm />);
    const textarea = screen.getByLabelText('Deskripsi');
    fireEvent.change(textarea, { target: { value: 'Test activity' } });

    // Uncheck all-day
    fireEvent.click(screen.getByLabelText('Seharian'));

    // Set end time before start time
    fireEvent.change(screen.getByLabelText('Waktu mulai'), {
      target: { value: '14:00' },
    });
    fireEvent.change(screen.getByLabelText('Waktu selesai'), {
      target: { value: '10:00' },
    });

    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => {
      expect(screen.getByTestId('error-time')).toHaveTextContent(
        'waktu selesai harus setelah waktu mulai',
      );
    });
    expect(mockInsertEvent).not.toHaveBeenCalled();
  });

  it('disables submit button while submitting', async () => {
    // Make insertEvent hang until we resolve it
    let resolveInsert!: (value: { ok: true; eventId: string }) => void;
    mockInsertEvent.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInsert = resolve;
        }),
    );

    render(<ActivityForm />);
    const textarea = screen.getByLabelText('Deskripsi');
    fireEvent.change(textarea, { target: { value: 'Test activity' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });

    // Resolve the insert
    resolveInsert({ ok: true, eventId: 'evt-123' });

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).not.toBeDisabled();
    });
  });

  it('shows confirmation and clears description on successful submit', async () => {
    mockInsertEvent.mockResolvedValue({ ok: true, eventId: 'evt-123' });

    render(<ActivityForm />);
    const textarea = screen.getByLabelText('Deskripsi') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Completed task X' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('confirmation')).toBeInTheDocument();
    });

    // Description cleared
    expect(textarea.value).toBe('');
    // Date is retained
    const dateInput = screen.getByLabelText('Tanggal') as HTMLInputElement;
    expect(dateInput.value).not.toBe('');
  });

  it('shows error toast and retains values on non-2xx response', async () => {
    mockInsertEvent.mockResolvedValue({
      ok: false,
      status: 500,
      message: 'Internal Server Error',
    });

    render(<ActivityForm />);
    const textarea = screen.getByLabelText('Deskripsi') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'My activity' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-error')).toHaveTextContent('Internal Server Error');
    });

    // Values retained
    expect(textarea.value).toBe('My activity');
  });

  it('calls buildEventPayload and insertEvent with correct arguments on submit', async () => {
    mockInsertEvent.mockResolvedValue({ ok: true, eventId: 'evt-456' });

    render(<ActivityForm />);
    const textarea = screen.getByLabelText('Deskripsi');
    fireEvent.change(textarea, { target: { value: 'Daily standup' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(mockInsertEvent).toHaveBeenCalledTimes(1);
    });

    const [payload, auth] = mockInsertEvent.mock.calls[0];
    // Payload should have summary = trimmed description
    expect(payload.summary).toBe('Daily standup');
    // Auth object should have getValidAccessToken
    expect(auth).toHaveProperty('getValidAccessToken');
  });
});
