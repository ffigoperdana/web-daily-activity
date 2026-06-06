import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { id } from '../i18n/id';
import { subscribePush } from '../push/subscribe';
import { getSettings, postSettings, postSubscribe, postDispatchTest } from '../push/client';

/** Check if Web Push is supported on this device/browser. */
function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function RemindersScreen() {
  const { status, getIdToken } = useAuth();

  const [time, setTime] = useState('08:00');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pushSupported] = useState(isPushSupported);

  useEffect(() => {
    if (status !== 'signed-in') return;
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const idToken = await getIdToken();
        const settings = await getSettings(idToken);
        if (cancelled) return;
        if (settings.configured) {
          setTime(settings.time);
          setTimezone(settings.timezone);
        } else {
          setTime('08:00');
          setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
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
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'notification_denied') {
        setPermissionDenied(true);
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTesting(false);
    }
  }, [getIdToken]);

  if (status !== 'signed-in') return null;

  if (loading) {
    return (
      <div className="card" data-testid="reminders-loading" role="status" aria-busy="true">
        <div className="loading-screen">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="reminders-section" data-testid="reminders-screen">
      {error && (
        <div className="alert alert-error" data-testid="reminders-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" data-testid="reminders-success" role="status">
          {success}
        </div>
      )}

      {/* Reminder time card */}
      <div className="card">
        <h2 className="section-title">Jam Pengingat</h2>

        <div className="form-group">
          <label htmlFor="reminder-time" className="form-label">
            Waktu
          </label>
          <input
            id="reminder-time"
            className="form-input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            data-testid="reminder-time-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="reminder-timezone" className="form-label">
            Timezone
          </label>
          <input
            id="reminder-timezone"
            className="form-input mono"
            type="text"
            value={timezone}
            readOnly
            data-testid="reminder-timezone-input"
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveSettings}
          disabled={saving}
          data-testid="btn-save-settings"
        >
          {saving ? 'Menyimpan…' : id.simpan_jam_pengingat}
        </button>
      </div>

      {/* Push subscription card */}
      <div className="card">
        <h2 className="section-title">Notifikasi Push</h2>

        {!pushSupported && (
          <div className="alert alert-warn" data-testid="push-not-supported">
            {id.notifikasi_tidak_tersedia}
            {/iPhone|iPad|iPod/.test(navigator.userAgent) && (
              <p style={{ marginTop: '8px', fontSize: '0.8125rem' }}>
                iOS: pastikan app dibuka dari Home Screen (bukan Safari), dan iOS versi 16.4+.
              </p>
            )}
          </div>
        )}

        {pushSupported && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSubscribe}
              disabled={subscribing}
              data-testid="btn-subscribe"
              style={{ marginBottom: '12px' }}
            >
              {subscribing ? 'Mengaktifkan…' : id.aktifkan_pengingat}
            </button>

            {permissionDenied && (
              <div className="alert alert-warn" data-testid="permission-denied-message" role="alert">
                {id.izinkan_notifikasi}
              </div>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleTestNotification}
              disabled={testing}
              data-testid="btn-test-notification"
            >
              {testing ? 'Mengirim…' : id.kirim_notifikasi_tes}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
