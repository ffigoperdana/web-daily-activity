import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the auth module
const mockUseAuth = vi.fn();
vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

// Mock child components
vi.mock('./components/SignIn', () => ({
  SignIn: () => <div data-testid="sign-in-mock">SignIn</div>,
}));
vi.mock('./components/ActivityForm', () => ({
  ActivityForm: () => <div data-testid="activity-form-mock">ActivityForm</div>,
}));
vi.mock('./components/RemindersScreen', () => ({
  RemindersScreen: () => <div data-testid="reminders-screen-mock">RemindersScreen</div>,
}));

// Mock sw/register
const mockOnUpdateAvailable = vi.fn<[(cb: () => void) => void]>().mockReturnValue(() => {});
const mockApplyUpdate = vi.fn();
vi.mock('./sw/register', () => ({
  onUpdateAvailable: (cb: () => void) => mockOnUpdateAvailable(cb),
  applyUpdate: () => mockApplyUpdate(),
}));

import App from './App';

describe('App shell', () => {
  let originalLocation: Location;

  beforeEach(() => {
    localStorage.clear();

    mockUseAuth.mockReturnValue({
      status: 'signed-in',
      email: 'owner@example.com',
      signIn: vi.fn(),
      signOut: vi.fn(),
      getValidAccessToken: vi.fn(),
      getIdToken: vi.fn(),
      retryInit: vi.fn(),
    });

    // Default: online
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

    // Mock location.search
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search: '', reload: vi.fn() },
      writable: true,
      configurable: true,
    });

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    mockOnUpdateAvailable.mockReturnValue(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('renders SignIn when status is not signed-in', () => {
    mockUseAuth.mockReturnValue({
      status: 'signed-out',
      email: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getValidAccessToken: vi.fn(),
      getIdToken: vi.fn(),
      retryInit: vi.fn(),
    });

    render(<App />);
    expect(
      screen.getByRole('dialog', { name: 'Aplikasi masih dalam tahap beta' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-form-mock')).not.toBeInTheDocument();
  });

  it('shows beta notice with email and WhatsApp links before login', () => {
    mockUseAuth.mockReturnValue({
      status: 'signed-out',
      email: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getValidAccessToken: vi.fn(),
      getIdToken: vi.fn(),
      retryInit: vi.fn(),
    });

    render(<App />);

    const emailHref = screen.getByTestId('btn-email').getAttribute('href') ?? '';
    const emailUrl = new URL(emailHref);
    const whatsappHref = screen.getByTestId('btn-whatsapp').getAttribute('href') ?? '';
    const whatsappUrl = new URL(whatsappHref);

    expect(screen.getByTestId('beta-notice-modal')).toBeInTheDocument();
    expect(emailUrl.protocol).toBe('mailto:');
    expect(emailUrl.pathname).toBe('perdanaputrafigo@gmail.com');
    expect(emailUrl.searchParams.get('subject')).toBe(
      'Permintaan Akses Beta Daily Activity Tracker',
    );
    expect(emailUrl.searchParams.get('body')).toContain(
      'Saya ingin mencoba aplikasi Daily Activity Tracker versi beta.',
    );
    expect(whatsappUrl.origin).toBe('https://wa.me');
    expect(whatsappUrl.pathname).toBe('/6281216195308');
    expect(whatsappUrl.searchParams.get('text')).toContain(
      'Permintaan Akses Beta Daily Activity Tracker',
    );
  });

  it('persists beta notice dismissal after close', () => {
    mockUseAuth.mockReturnValue({
      status: 'signed-out',
      email: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      getValidAccessToken: vi.fn(),
      getIdToken: vi.fn(),
      retryInit: vi.fn(),
    });

    const { unmount } = render(<App />);
    fireEvent.click(screen.getByTestId('btn-close-beta-notice'));

    expect(screen.queryByTestId('beta-notice-modal')).not.toBeInTheDocument();
    expect(localStorage.getItem('tracker-beta-notice-dismissed')).toBe('true');

    unmount();
    render(<App />);

    expect(screen.queryByTestId('beta-notice-modal')).not.toBeInTheDocument();
  });

  it('renders ActivityForm by default when signed in and route=form', () => {
    window.location.search = '?route=form';
    render(<App />);
    expect(screen.getByTestId('activity-form-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('sign-in-mock')).not.toBeInTheDocument();
  });

  it('renders ActivityForm when no route param is present (default)', () => {
    window.location.search = '';
    render(<App />);
    expect(screen.getByTestId('activity-form-mock')).toBeInTheDocument();
  });

  it('renders RemindersScreen when route=reminders', () => {
    window.location.search = '?route=reminders';
    render(<App />);
    expect(screen.getByTestId('reminders-screen-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-form-mock')).not.toBeInTheDocument();
  });

  it('shows offline banner when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<App />);
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(
      'tidak ada koneksi — coba lagi nanti',
    );
  });

  it('hides offline banner when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    render(<App />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('shows offline banner on offline event and hides on online event', () => {
    render(<App />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    // Simulate going offline
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

    // Simulate going online
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('shows update toast when onUpdateAvailable fires', () => {
    let updateCb: (() => void) | undefined;
    mockOnUpdateAvailable.mockImplementation((cb: () => void) => {
      updateCb = cb;
      return () => {};
    });

    render(<App />);
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();

    // Trigger update available
    act(() => {
      updateCb?.();
    });

    expect(screen.getByTestId('update-toast')).toBeInTheDocument();
    expect(screen.getByTestId('update-toast')).toHaveTextContent('versi baru tersedia');
    expect(screen.getByTestId('btn-reload')).toHaveTextContent('muat ulang');
  });

  it('calls applyUpdate when reload button is clicked', () => {
    let updateCb: (() => void) | undefined;
    mockOnUpdateAvailable.mockImplementation((cb: () => void) => {
      updateCb = cb;
      return () => {};
    });

    render(<App />);
    act(() => {
      updateCb?.();
    });

    fireEvent.click(screen.getByTestId('btn-reload'));
    expect(mockApplyUpdate).toHaveBeenCalledOnce();
  });

  it('dismisses the update toast when dismiss button is clicked', () => {
    let updateCb: (() => void) | undefined;
    mockOnUpdateAvailable.mockImplementation((cb: () => void) => {
      updateCb = cb;
      return () => {};
    });

    render(<App />);
    act(() => {
      updateCb?.();
    });

    expect(screen.getByTestId('update-toast')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-dismiss-toast'));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });

  it('updates route when SW posts NAVIGATE message', () => {
    let messageHandler: ((event: MessageEvent) => void) | undefined;
    const mockAddEventListener = vi.fn((event: string, handler: (event: MessageEvent) => void) => {
      if (event === 'message') messageHandler = handler;
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    window.location.search = '?route=form';
    render(<App />);
    expect(screen.getByTestId('activity-form-mock')).toBeInTheDocument();

    // Simulate NAVIGATE message from SW
    act(() => {
      messageHandler?.(
        new MessageEvent('message', {
          data: { type: 'NAVIGATE', route: '/?route=reminders' },
        }),
      );
    });

    expect(screen.getByTestId('reminders-screen-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-form-mock')).not.toBeInTheDocument();
  });
});
