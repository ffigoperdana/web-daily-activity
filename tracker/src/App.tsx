import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SignIn } from './components/SignIn';
import { ActivityForm } from './components/ActivityForm';
import { RemindersScreen } from './components/RemindersScreen';
import { onUpdateAvailable, applyUpdate } from './sw/register';
import { id } from './i18n/id';

type Route = 'form' | 'reminders';

function parseRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  const route = params.get('route');
  if (route === 'reminders') return 'reminders';
  return 'form';
}

function AppShell() {
  const { status } = useAuth();
  const [route, setRoute] = useState<Route>(parseRoute);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);

  // Listen for SW NAVIGATE postMessage
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

  // Online/offline listeners
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

  // Subscribe to SW update available
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

  // Auth gate: show SignIn for any status that is not 'signed-in'
  if (status !== 'signed-in') {
    return (
      <>
        {offline && (
          <div data-testid="offline-banner" role="alert">
            {id.tidak_ada_koneksi}
          </div>
        )}
        <SignIn />
      </>
    );
  }

  return (
    <>
      {offline && (
        <div data-testid="offline-banner" role="alert">
          {id.tidak_ada_koneksi}
        </div>
      )}

      {updateAvailable && !toastDismissed && (
        <div data-testid="update-toast" role="status">
          <span>{id.versi_baru_tersedia}</span>
          <button type="button" onClick={handleReload} data-testid="btn-reload">
            {id.muat_ulang}
          </button>
          <button
            type="button"
            onClick={handleDismissToast}
            data-testid="btn-dismiss-toast"
            aria-label="tutup"
          >
            ×
          </button>
        </div>
      )}

      {route === 'form' && <ActivityForm />}
      {route === 'reminders' && <RemindersScreen />}
    </>
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
