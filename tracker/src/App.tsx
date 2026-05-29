import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SignIn } from './components/SignIn';
import { ActivityForm } from './components/ActivityForm';
import { RemindersScreen } from './components/RemindersScreen';
import { onUpdateAvailable, applyUpdate } from './sw/register';
import { id } from './i18n/id';
import './styles.css';

type Route = 'form' | 'reminders';

function parseRoute(): Route {
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

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}

function AppShell() {
  const { status } = useAuth();
  const [route, setRoute] = useState<Route>(parseRoute);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        const url = event.data.route as string | undefined;
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
    return (
      <div className="app-container">
        <div
          className="loading-screen"
          data-testid="sign-in-loading"
          role="status"
          aria-busy="true"
        >
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (status !== 'signed-in') {
    return (
      <div className="app-container">
        {offline && (
          <div className="offline-banner" data-testid="offline-banner" role="alert">
            {id.tidak_ada_koneksi}
          </div>
        )}
        <SignIn />
      </div>
    );
  }

  return (
    <div className="app-container">
      {offline && (
        <div className="offline-banner" data-testid="offline-banner" role="alert">
          {id.tidak_ada_koneksi}
        </div>
      )}

      {updateAvailable && !toastDismissed && (
        <div className="update-toast" data-testid="update-toast" role="status">
          <span>{id.versi_baru_tersedia}</span>
          <button
            type="button"
            className="toast-action"
            onClick={handleReload}
            data-testid="btn-reload"
          >
            {id.muat_ulang}
          </button>
          <button
            type="button"
            className="toast-dismiss"
            onClick={handleDismissToast}
            data-testid="btn-dismiss-toast"
            aria-label="tutup"
          >
            ×
          </button>
        </div>
      )}

      <header className="app-header">
        <h1 className="app-title">Aktivitas</h1>
        <ThemeToggle />
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={`tab-btn ${route === 'form' ? 'active' : ''}`}
          onClick={() => setRoute('form')}
        >
          Catat
        </button>
        <button
          type="button"
          className={`tab-btn ${route === 'reminders' ? 'active' : ''}`}
          onClick={() => setRoute('reminders')}
        >
          Pengingat
        </button>
      </nav>

      {route === 'form' && <ActivityForm />}
      {route === 'reminders' && <RemindersScreen />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
