import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SignIn } from './components/SignIn';
import { ActivityForm } from './components/ActivityForm';
import { RemindersScreen } from './components/RemindersScreen';
import { onUpdateAvailable, applyUpdate } from './sw/register';
import { id } from './i18n/id';
import './styles.css';
function parseRoute() {
  const params = new URLSearchParams(window.location.search);
  const route = params.get('route');
  if (route === 'reminders') return 'reminders';
  return 'form';
}
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('tracker-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('tracker-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return _jsx('button', {
    type: 'button',
    className: 'theme-toggle',
    onClick: () => setDark((d) => !d),
    'aria-label': dark ? 'Switch to light mode' : 'Switch to dark mode',
    children: dark ? '☀' : '☾',
  });
}
function AppShell() {
  const { status } = useAuth();
  const [route, setRoute] = useState(parseRoute);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  useEffect(() => {
    const handler = (event) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        const url = event.data.route;
        if (url) {
          const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
          const newRoute = params.get('route');
          setRoute(newRoute === 'reminders' ? 'reminders' : 'form');
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handler);
    };
  }, []);
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);
  useEffect(() => {
    const unsubscribe = onUpdateAvailable(() => {
      setUpdateAvailable(true);
    });
    return unsubscribe;
  }, []);
  const handleDismissToast = useCallback(() => {
    setToastDismissed(true);
  }, []);
  const handleReload = useCallback(() => {
    applyUpdate();
  }, []);
  if (status === 'loading') {
    return _jsx('div', {
      className: 'app-container',
      children: _jsx('div', {
        className: 'loading-screen',
        'data-testid': 'sign-in-loading',
        role: 'status',
        'aria-busy': 'true',
        children: _jsx('div', { className: 'spinner' }),
      }),
    });
  }
  if (status !== 'signed-in') {
    return _jsxs('div', {
      className: 'app-container',
      children: [
        offline &&
          _jsx('div', {
            className: 'offline-banner',
            'data-testid': 'offline-banner',
            role: 'alert',
            children: id.tidak_ada_koneksi,
          }),
        _jsx(SignIn, {}),
      ],
    });
  }
  return _jsxs('div', {
    className: 'app-container',
    children: [
      offline &&
        _jsx('div', {
          className: 'offline-banner',
          'data-testid': 'offline-banner',
          role: 'alert',
          children: id.tidak_ada_koneksi,
        }),
      updateAvailable &&
        !toastDismissed &&
        _jsxs('div', {
          className: 'update-toast',
          'data-testid': 'update-toast',
          role: 'status',
          children: [
            _jsx('span', { children: id.versi_baru_tersedia }),
            _jsx('button', {
              type: 'button',
              className: 'toast-action',
              onClick: handleReload,
              'data-testid': 'btn-reload',
              children: id.muat_ulang,
            }),
            _jsx('button', {
              type: 'button',
              className: 'toast-dismiss',
              onClick: handleDismissToast,
              'data-testid': 'btn-dismiss-toast',
              'aria-label': 'tutup',
              children: '\u00D7',
            }),
          ],
        }),
      _jsxs('header', {
        className: 'app-header',
        children: [
          _jsx('h1', { className: 'app-title', children: 'Aktivitas' }),
          _jsx(ThemeToggle, {}),
        ],
      }),
      _jsxs('nav', {
        className: 'tabs',
        children: [
          _jsx('button', {
            type: 'button',
            className: `tab-btn ${route === 'form' ? 'active' : ''}`,
            onClick: () => setRoute('form'),
            children: 'Catat',
          }),
          _jsx('button', {
            type: 'button',
            className: `tab-btn ${route === 'reminders' ? 'active' : ''}`,
            onClick: () => setRoute('reminders'),
            children: 'Pengingat',
          }),
        ],
      }),
      route === 'form' && _jsx(ActivityForm, {}),
      route === 'reminders' && _jsx(RemindersScreen, {}),
    ],
  });
}
function App() {
  return _jsx(AuthProvider, { children: _jsx(AppShell, {}) });
}
export default App;
//# sourceMappingURL=App.js.map
