import { Fragment as _Fragment, jsx as _jsx } from 'react/jsx-runtime';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Mock the auth module
const mockUseAuth = vi.fn();
vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }) => _jsx(_Fragment, { children: children }),
  useAuth: () => mockUseAuth(),
}));
// Mock child components
vi.mock('./components/SignIn', () => ({
  SignIn: () => _jsx('div', { 'data-testid': 'sign-in-mock', children: 'SignIn' }),
}));
vi.mock('./components/ActivityForm', () => ({
  ActivityForm: () =>
    _jsx('div', { 'data-testid': 'activity-form-mock', children: 'ActivityForm' }),
}));
vi.mock('./components/RemindersScreen', () => ({
  RemindersScreen: () =>
    _jsx('div', { 'data-testid': 'reminders-screen-mock', children: 'RemindersScreen' }),
}));
// Mock sw/register
const mockOnUpdateAvailable = vi.fn().mockReturnValue(() => {});
const mockApplyUpdate = vi.fn();
vi.mock('./sw/register', () => ({
  onUpdateAvailable: (cb) => mockOnUpdateAvailable(cb),
  applyUpdate: () => mockApplyUpdate(),
}));
import App from './App';
describe('App shell', () => {
  let originalLocation;
  beforeEach(() => {
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
    render(_jsx(App, {}));
    expect(screen.getByTestId('sign-in-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-form-mock')).not.toBeInTheDocument();
  });
  it('renders ActivityForm by default when signed in and route=form', () => {
    window.location.search = '?route=form';
    render(_jsx(App, {}));
    expect(screen.getByTestId('activity-form-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('sign-in-mock')).not.toBeInTheDocument();
  });
  it('renders ActivityForm when no route param is present (default)', () => {
    window.location.search = '';
    render(_jsx(App, {}));
    expect(screen.getByTestId('activity-form-mock')).toBeInTheDocument();
  });
  it('renders RemindersScreen when route=reminders', () => {
    window.location.search = '?route=reminders';
    render(_jsx(App, {}));
    expect(screen.getByTestId('reminders-screen-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-form-mock')).not.toBeInTheDocument();
  });
  it('shows offline banner when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    render(_jsx(App, {}));
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(
      'tidak ada koneksi — coba lagi nanti',
    );
  });
  it('hides offline banner when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    render(_jsx(App, {}));
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
  it('shows offline banner on offline event and hides on online event', () => {
    render(_jsx(App, {}));
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
    let updateCb;
    mockOnUpdateAvailable.mockImplementation((cb) => {
      updateCb = cb;
      return () => {};
    });
    render(_jsx(App, {}));
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
    let updateCb;
    mockOnUpdateAvailable.mockImplementation((cb) => {
      updateCb = cb;
      return () => {};
    });
    render(_jsx(App, {}));
    act(() => {
      updateCb?.();
    });
    fireEvent.click(screen.getByTestId('btn-reload'));
    expect(mockApplyUpdate).toHaveBeenCalledOnce();
  });
  it('dismisses the update toast when dismiss button is clicked', () => {
    let updateCb;
    mockOnUpdateAvailable.mockImplementation((cb) => {
      updateCb = cb;
      return () => {};
    });
    render(_jsx(App, {}));
    act(() => {
      updateCb?.();
    });
    expect(screen.getByTestId('update-toast')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-dismiss-toast'));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });
  it('updates route when SW posts NAVIGATE message', () => {
    let messageHandler;
    const mockAddEventListener = vi.fn((event, handler) => {
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
    render(_jsx(App, {}));
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
//# sourceMappingURL=App.test.js.map
