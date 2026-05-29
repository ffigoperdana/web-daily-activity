import type { ReactNode } from 'react';
export interface AuthContextValue {
  status: 'loading' | 'signed-out' | 'signed-in' | 'forbidden' | 'init-failed';
  email: string | null;
  signIn(): Promise<void>;
  signOut(): void;
  getValidAccessToken(): Promise<string>;
  getIdToken(): Promise<string>;
  retryInit(): void;
}
/**
 * Base64url-decode the JWT payload and extract the `email` claim.
 * No signature verification — the server is the trust boundary.
 */
export declare function decodeIdTokenEmail(idToken: string): string | null;
/**
 * Case-insensitive email comparison.
 */
export declare function isOwner(email: string, ownerEmail: string): boolean;
export declare function AuthProvider({
  children,
}: {
  children: ReactNode;
}): import('react/jsx-runtime').JSX.Element;
export declare function useAuth(): AuthContextValue;
//# sourceMappingURL=AuthContext.d.ts.map
