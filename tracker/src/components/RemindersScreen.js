import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { id } from '../i18n/id';
import { subscribePush } from '../push/subscribe';
import { getSettings, postSettings, postSubscribe, postDispatchTest } from '../push/client';
export function RemindersScreen() {
    const { status, getIdToken } = useAuth();
    const [time, setTime] = useState('08:00');
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [loading, setLoading] = useState(true);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [subscribing, setSubscribing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    useEffect(() => {
        if (status !== 'signed-in')
            return;
        let cancelled = false;
        const loadSettings = async () => {
            try {
                const idToken = await getIdToken();
                const settings = await getSettings(idToken);
                if (cancelled)
                    return;
                if (settings.configured) {
                    setTime(settings.time);
                    setTimezone(settings.timezone);
                }
                else {
                    setTime('08:00');
                    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
                }
            }
            catch {
                // Silently handle
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void loadSettings();
        return () => { cancelled = true; };
    }, [status, getIdToken]);
    useEffect(() => {
        if (typeof Notification !== 'undefined') {
            setPermissionDenied(Notification.permission === 'denied');
        }
    }, []);
    const handleSubscribe = useCallback(async () => {
        setError(null);
        setSuccess(null);
        setSubscribing(true);
        try {
            const subscription = await subscribePush();
            const idToken = await getIdToken();
            await postSubscribe(idToken, subscription.toJSON());
            setPermissionDenied(false);
            setSuccess('Pengingat berhasil diaktifkan');
        }
        catch (err) {
            if (err instanceof Error && err.message === 'notification_denied') {
                setPermissionDenied(true);
            }
            else {
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        }
        finally {
            setSubscribing(false);
        }
    }, [getIdToken]);
    const handleSaveSettings = useCallback(async () => {
        setError(null);
        setSuccess(null);
        setSaving(true);
        try {
            const idToken = await getIdToken();
            await postSettings(idToken, { time, timezone });
            setSuccess('Jam pengingat tersimpan');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
        finally {
            setSaving(false);
        }
    }, [getIdToken, time, timezone]);
    const handleTestNotification = useCallback(async () => {
        setError(null);
        setSuccess(null);
        setTesting(true);
        try {
            const idToken = await getIdToken();
            await postDispatchTest(idToken);
            setSuccess('Notifikasi tes terkirim');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
        finally {
            setTesting(false);
        }
    }, [getIdToken]);
    if (status !== 'signed-in')
        return null;
    if (loading) {
        return (_jsx("div", { className: "card", "data-testid": "reminders-loading", role: "status", "aria-busy": "true", children: _jsx("div", { className: "loading-screen", children: _jsx("div", { className: "spinner" }) }) }));
    }
    return (_jsxs("div", { className: "reminders-section", "data-testid": "reminders-screen", children: [error && (_jsx("div", { className: "alert alert-error", "data-testid": "reminders-error", role: "alert", children: error })), success && (_jsx("div", { className: "alert alert-success", "data-testid": "reminders-success", role: "status", children: success })), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "section-title", children: "Jam Pengingat" }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "reminder-time", className: "form-label", children: "Waktu" }), _jsx("input", { id: "reminder-time", className: "form-input", type: "time", value: time, onChange: (e) => setTime(e.target.value), "data-testid": "reminder-time-input" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "reminder-timezone", className: "form-label", children: "Timezone" }), _jsx("input", { id: "reminder-timezone", className: "form-input mono", type: "text", value: timezone, readOnly: true, "data-testid": "reminder-timezone-input" })] }), _jsx("button", { type: "button", className: "btn btn-primary", onClick: handleSaveSettings, disabled: saving, "data-testid": "btn-save-settings", children: saving ? 'Menyimpan…' : id.simpan_jam_pengingat })] }), _jsxs("div", { className: "card", children: [_jsx("h2", { className: "section-title", children: "Notifikasi Push" }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleSubscribe, disabled: subscribing, "data-testid": "btn-subscribe", style: { marginBottom: '12px' }, children: subscribing ? 'Mengaktifkan…' : id.aktifkan_pengingat }), permissionDenied && (_jsx("div", { className: "alert alert-warn", "data-testid": "permission-denied-message", role: "alert", children: id.izinkan_notifikasi })), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: handleTestNotification, disabled: testing, "data-testid": "btn-test-notification", children: testing ? 'Mengirim…' : id.kirim_notifikasi_tes })] })] }));
}
//# sourceMappingURL=RemindersScreen.js.map