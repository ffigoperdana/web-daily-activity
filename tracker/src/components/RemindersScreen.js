import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { id } from '../i18n/id';
import { subscribePush } from '../push/subscribe';
import { getSettings, postSettings, postSubscribe, postDispatchTest } from '../push/client';
/**
 * RemindersScreen — allows the signed-in Owner_Account to configure
 * push notification reminders: enable push, set reminder time, and
 * send a test notification.
 *
 * Visible only when `status === 'signed-in'`.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7, 5.8, 6.1, 6.2, 6.6, 10.1, 10.4
 */
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
    // Load current settings on mount
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
                    // Prefill defaults per Requirement 10.4
                    setTime('08:00');
                    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
                }
            }
            catch {
                // Silently handle load errors — user can still interact
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        void loadSettings();
        return () => {
            cancelled = true;
        };
    }, [status, getIdToken]);
    // Check current permission state to determine if denied message should show.
    // Per Requirement 5.8: do not show the denied message while permission is granted.
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
            // After successful subscribe, permission is granted
            setPermissionDenied(false);
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
            setSuccess('ok');
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
        finally {
            setTesting(false);
        }
    }, [getIdToken]);
    // Only visible to signed-in Owner_Account (Requirement 5.1)
    if (status !== 'signed-in') {
        return null;
    }
    if (loading) {
        return (_jsx("div", { "data-testid": "reminders-loading", role: "status", "aria-busy": "true", children: _jsx("span", { children: "Loading\u2026" }) }));
    }
    return (_jsxs("div", { "data-testid": "reminders-screen", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "reminder-time", children: id.simpan_jam_pengingat }), _jsx("input", { id: "reminder-time", type: "time", value: time, onChange: (e) => setTime(e.target.value), "data-testid": "reminder-time-input" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "reminder-timezone", children: "Timezone" }), _jsx("input", { id: "reminder-timezone", type: "text", value: timezone, readOnly: true, "data-testid": "reminder-timezone-input" })] }), _jsx("button", { type: "button", onClick: handleSubscribe, disabled: subscribing, "data-testid": "btn-subscribe", children: id.aktifkan_pengingat }), permissionDenied && (_jsx("p", { "data-testid": "permission-denied-message", role: "alert", children: id.izinkan_notifikasi })), _jsx("button", { type: "button", onClick: handleSaveSettings, disabled: saving, "data-testid": "btn-save-settings", children: id.simpan_jam_pengingat }), _jsx("button", { type: "button", onClick: handleTestNotification, disabled: testing, "data-testid": "btn-test-notification", children: id.kirim_notifikasi_tes }), error && (_jsx("p", { "data-testid": "reminders-error", role: "alert", children: error })), success && (_jsx("p", { "data-testid": "reminders-success", role: "status", children: success }))] }));
}
//# sourceMappingURL=RemindersScreen.js.map