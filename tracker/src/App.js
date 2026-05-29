import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SignIn } from './components/SignIn';
import { ActivityForm } from './components/ActivityForm';
import { RemindersScreen } from './components/RemindersScreen';
import { onUpdateAvailable, applyUpdate } from './sw/register';
import { id } from './i18n/id';
function parseRoute() {
    const params = new URLSearchParams(window.location.search);
    const route = params.get('route');
    if (route === 'reminders')
        return 'reminders';
    return 'form';
}
function AppShell() {
    const { status } = useAuth();
    const [route, setRoute] = useState(parseRoute);
    const [offline, setOffline] = useState(!navigator.onLine);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [toastDismissed, setToastDismissed] = useState(false);
    // Listen for SW NAVIGATE postMessage
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
        return (_jsxs(_Fragment, { children: [offline && (_jsx("div", { "data-testid": "offline-banner", role: "alert", children: id.tidak_ada_koneksi })), _jsx(SignIn, {})] }));
    }
    return (_jsxs(_Fragment, { children: [offline && (_jsx("div", { "data-testid": "offline-banner", role: "alert", children: id.tidak_ada_koneksi })), updateAvailable && !toastDismissed && (_jsxs("div", { "data-testid": "update-toast", role: "status", children: [_jsx("span", { children: id.versi_baru_tersedia }), _jsx("button", { type: "button", onClick: handleReload, "data-testid": "btn-reload", children: id.muat_ulang }), _jsx("button", { type: "button", onClick: handleDismissToast, "data-testid": "btn-dismiss-toast", "aria-label": "tutup", children: "\u00D7" })] })), route === 'form' && _jsx(ActivityForm, {}), route === 'reminders' && _jsx(RemindersScreen, {})] }));
}
function App() {
    return (_jsx(AuthProvider, { children: _jsx(AppShell, {}) }));
}
export default App;
//# sourceMappingURL=App.js.map