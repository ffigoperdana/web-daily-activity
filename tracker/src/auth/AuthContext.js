import { jsx as _jsx } from 'react/jsx-runtime';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadGisScript } from './gis-loader';
// ---------------------------------------------------------------------------
// Helpers (exported for unit testing)
// ---------------------------------------------------------------------------
/**
 * Base64url-decode the JWT payload and extract the `email` claim.
 * No signature verification — the server is the trust boundary.
 */
export function decodeIdTokenEmail(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url → Base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const claims = JSON.parse(json);
    return claims.email ?? null;
  } catch {
    return null;
  }
}
/**
 * Case-insensitive email comparison.
 */
export function isOwner(email, ownerEmail) {
  return email.toLowerCase() === ownerEmail.toLowerCase();
}
// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext(null);
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL;
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [email, setEmail] = useState(null);
  // Tokens held in React state only — never localStorage/sessionStorage
  const [tokenState, setTokenState] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const tokenClientRef = useRef(null);
  // Promise resolvers for the imperative requestAccessToken callback
  const accessTokenResolveRef = useRef(null);
  const accessTokenRejectRef = useRef(null);
  // ------------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------------
  const initClients = useCallback(async () => {
    setStatus('loading');
    try {
      await loadGisScript();
      // Initialize the OAuth2 token client
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (response) => {
          if (response.error) {
            accessTokenRejectRef.current?.(new Error(response.error_description ?? response.error));
            accessTokenRejectRef.current = null;
            accessTokenResolveRef.current = null;
            return;
          }
          const expiresAt = Date.now() + response.expires_in * 1000;
          setTokenState({ accessToken: response.access_token, expiresAt });
          accessTokenResolveRef.current?.(response.access_token);
          accessTokenResolveRef.current = null;
          accessTokenRejectRef.current = null;
        },
        error_callback: (error) => {
          accessTokenRejectRef.current?.(new Error(error.message));
          accessTokenRejectRef.current = null;
          accessTokenResolveRef.current = null;
        },
      });
      tokenClientRef.current = tokenClient;
      // Initialize the ID token client (One Tap / credential)
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          const credential = response.credential;
          setIdToken(credential);
          const decodedEmail = decodeIdTokenEmail(credential);
          if (decodedEmail && isOwner(decodedEmail, OWNER_EMAIL)) {
            setEmail(decodedEmail);
            setStatus('signed-in');
          } else {
            // Forbidden: clear access token
            setTokenState(null);
            setEmail(decodedEmail);
            setStatus('forbidden');
          }
        },
      });
      setStatus('signed-out');
    } catch {
      setStatus('init-failed');
    }
  }, []);
  useEffect(() => {
    void initClients();
  }, [initClients]);
  // ------------------------------------------------------------------
  // signIn
  // ------------------------------------------------------------------
  const signIn = useCallback(async () => {
    if (!tokenClientRef.current) {
      throw new Error('Token client not initialized');
    }
    // Request access token (triggers consent/sign-in popup)
    const accessTokenPromise = new Promise((resolve, reject) => {
      accessTokenResolveRef.current = resolve;
      accessTokenRejectRef.current = reject;
    });
    tokenClientRef.current.requestAccessToken();
    await accessTokenPromise;
    // Prompt for ID token (One Tap)
    google.accounts.id.prompt();
  }, []);
  // ------------------------------------------------------------------
  // signOut
  // ------------------------------------------------------------------
  const signOut = useCallback(() => {
    setTokenState(null);
    setIdToken(null);
    setEmail(null);
    setStatus('signed-out');
  }, []);
  // ------------------------------------------------------------------
  // getValidAccessToken
  // ------------------------------------------------------------------
  const getValidAccessToken = useCallback(async () => {
    // Return cached token if still valid (with 60s buffer)
    if (tokenState && tokenState.expiresAt > Date.now() + 60_000) {
      return tokenState.accessToken;
    }
    // Silent refresh
    if (!tokenClientRef.current) {
      throw new Error('Token client not initialized');
    }
    return new Promise((resolve, reject) => {
      accessTokenResolveRef.current = resolve;
      accessTokenRejectRef.current = reject;
      tokenClientRef.current.requestAccessToken({ prompt: '' });
    });
  }, [tokenState]);
  // ------------------------------------------------------------------
  // getIdToken
  // ------------------------------------------------------------------
  const getIdToken = useCallback(async () => {
    if (idToken) {
      return idToken;
    }
    throw new Error('No ID token available');
  }, [idToken]);
  // ------------------------------------------------------------------
  // retryInit
  // ------------------------------------------------------------------
  const retryInit = useCallback(() => {
    void initClients();
  }, [initClients]);
  // ------------------------------------------------------------------
  // Context value
  // ------------------------------------------------------------------
  const value = {
    status,
    email,
    signIn,
    signOut,
    getValidAccessToken,
    getIdToken,
    retryInit,
  };
  return _jsx(AuthContext.Provider, { value: value, children: children });
}
// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
//# sourceMappingURL=AuthContext.js.map
