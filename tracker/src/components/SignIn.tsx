import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { id } from '../i18n/id';

export function SignIn() {
  const { status, signIn, retryInit } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : id.gagal_simpan_calendar;
      setError(message);
    }
  };

  if (status === 'loading') {
    return (
      <div className="sign-in-screen" data-testid="sign-in-loading" role="status" aria-busy="true">
        <div className="spinner" />
      </div>
    );
  }

  if (status === 'init-failed') {
    return (
      <div className="sign-in-screen" data-testid="sign-in-init-failed">
        <div>
          <div className="app-logo">📋</div>
          <h1>Daily Tracker</h1>
        </div>
        <div className="alert alert-error">{id.gagal_memulai_login_google}</div>
        <button type="button" className="btn btn-secondary" onClick={retryInit}>
          {id.coba_lagi}
        </button>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="sign-in-screen" data-testid="sign-in-forbidden">
        <div>
          <div className="app-logo">🚫</div>
          <h1>Akses Ditolak</h1>
        </div>
        <div className="alert alert-error">{id.akun_tidak_diizinkan}</div>
      </div>
    );
  }

  return (
    <div className="sign-in-screen" data-testid="sign-in-screen">
      <div>
        <div className="app-logo">📋</div>
        <h1>Daily Tracker</h1>
        <p>Catat aktivitas harian ke Google Calendar</p>
      </div>
      <button type="button" className="btn btn-google" onClick={handleSignIn}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            fill="#EA4335"
          />
        </svg>
        Masuk dengan Google
      </button>
      {error && (
        <div className="alert alert-error" data-testid="sign-in-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
