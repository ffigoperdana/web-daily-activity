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
      const message =
        err instanceof Error ? err.message : id.gagal_simpan_calendar;
      setError(message);
    }
  };

  if (status === 'loading') {
    return (
      <div data-testid="sign-in-loading" role="status" aria-busy="true">
        <span>Loading…</span>
      </div>
    );
  }

  if (status === 'init-failed') {
    return (
      <div data-testid="sign-in-init-failed">
        <p>{id.gagal_memulai_login_google}</p>
        <button type="button" onClick={retryInit}>
          {id.coba_lagi}
        </button>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div data-testid="sign-in-forbidden">
        <p>{id.akun_tidak_diizinkan}</p>
      </div>
    );
  }

  // status === 'signed-out' (or fallback)
  return (
    <div data-testid="sign-in-screen">
      <button type="button" onClick={handleSignIn}>
        Masuk dengan Google
      </button>
      {error && (
        <p data-testid="sign-in-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
