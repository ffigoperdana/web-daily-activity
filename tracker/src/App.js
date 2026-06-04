import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SignIn } from './components/SignIn';
import { ActivityForm } from './components/ActivityForm';
import { RemindersScreen } from './components/RemindersScreen';
import { onUpdateAvailable, applyUpdate } from './sw/register';
import { id } from './i18n/id';
import './styles.css';
const BETA_NOTICE_STORAGE_KEY = 'tracker-beta-notice-dismissed';
const CONTACT_EMAIL = 'perdanaputrafigo@gmail.com';
const CONTACT_WHATSAPP = '6281216195308';
const CONTACT_SUBJECT = 'Permintaan Akses Beta Daily Activity Tracker';
const CONTACT_MESSAGE = [
  'Halo Figo,',
  '',
  'Saya ingin mencoba aplikasi Daily Activity Tracker versi beta.',
  'Email login yang ingin digunakan:',
  'Nama:',
  '',
  'Terima kasih.',
].join('\n');
const CONTACT_EMAIL_URL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  CONTACT_SUBJECT,
)}&body=${encodeURIComponent(CONTACT_MESSAGE)}`;
const CONTACT_WHATSAPP_URL = `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(
  `${CONTACT_SUBJECT}\n\n${CONTACT_MESSAGE}`,
)}`;
function parseRoute() {
  const params = new URLSearchParams(window.location.search);
  const route = params.get('route');
  if (route === 'reminders') return 'reminders';
  return 'form';
}
function BetaNoticeModal({ open, onClose }) {
  if (!open) return null;
  return _jsx('div', {
    className: 'modal-backdrop',
    role: 'presentation',
    'data-testid': 'beta-notice-modal',
    children: _jsxs('section', {
      className: 'modal-panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'beta-notice-title',
      children: [
        _jsx('button', {
          type: 'button',
          className: 'modal-close',
          onClick: onClose,
          'aria-label': 'tutup informasi beta',
          'data-testid': 'btn-close-beta-notice',
          children: 'x',
        }),
        _jsx('p', { className: 'modal-eyebrow', children: 'Beta Version' }),
        _jsx('h2', {
          id: 'beta-notice-title',
          className: 'modal-title',
          children: 'Aplikasi masih dalam tahap beta',
        }),
        _jsx('p', {
          className: 'modal-copy',
          children:
            'Untuk saat ini akses login masih dibatasi. Kalau ingin mencoba aplikasi ini, silakan hubungi Figo lewat email atau WhatsApp.',
        }),
        _jsxs('div', {
          className: 'modal-actions',
          children: [
            _jsx('a', {
              className: 'btn btn-primary',
              href: CONTACT_EMAIL_URL,
              'data-testid': 'btn-email',
              children: 'Email',
            }),
            _jsx('a', {
              className: 'btn btn-secondary',
              href: CONTACT_WHATSAPP_URL,
              target: '_blank',
              rel: 'noreferrer',
              'data-testid': 'btn-whatsapp',
              children: 'WhatsApp',
            }),
          ],
        }),
      ],
    }),
  });
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
  const [showBetaNotice, setShowBetaNotice] = useState(() => {
    return localStorage.getItem(BETA_NOTICE_STORAGE_KEY) !== 'true';
  });
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
  const handleCloseBetaNotice = useCallback(() => {
    localStorage.setItem(BETA_NOTICE_STORAGE_KEY, 'true');
    setShowBetaNotice(false);
  }, []);
  const betaNotice = _jsx(BetaNoticeModal, {
    open: showBetaNotice,
    onClose: handleCloseBetaNotice,
  });
  if (status === 'loading') {
    return _jsxs('div', {
      className: 'app-container',
      children: [
        betaNotice,
        _jsx('div', {
          className: 'loading-screen',
          'data-testid': 'sign-in-loading',
          role: 'status',
          'aria-busy': 'true',
          children: _jsx('div', { className: 'spinner' }),
        }),
      ],
    });
  }
  if (status !== 'signed-in') {
    return _jsxs('div', {
      className: 'app-container',
      children: [
        betaNotice,
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
      betaNotice,
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
