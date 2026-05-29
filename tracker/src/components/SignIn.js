import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { id } from '../i18n/id';
export function SignIn() {
    const { status, signIn, retryInit } = useAuth();
    const [error, setError] = useState(null);
    const handleSignIn = async () => {
        setError(null);
        try {
            await signIn();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : id.gagal_simpan_calendar;
            setError(message);
        }
    };
    if (status === 'loading') {
        return (_jsx("div", { "data-testid": "sign-in-loading", role: "status", "aria-busy": "true", children: _jsx("span", { children: "Loading\u2026" }) }));
    }
    if (status === 'init-failed') {
        return (_jsxs("div", { "data-testid": "sign-in-init-failed", children: [_jsx("p", { children: id.gagal_memulai_login_google }), _jsx("button", { type: "button", onClick: retryInit, children: id.coba_lagi })] }));
    }
    if (status === 'forbidden') {
        return (_jsx("div", { "data-testid": "sign-in-forbidden", children: _jsx("p", { children: id.akun_tidak_diizinkan }) }));
    }
    // status === 'signed-out' (or fallback)
    return (_jsxs("div", { "data-testid": "sign-in-screen", children: [_jsx("button", { type: "button", onClick: handleSignIn, children: "Masuk dengan Google" }), error && (_jsx("p", { "data-testid": "sign-in-error", role: "alert", children: error }))] }));
}
//# sourceMappingURL=SignIn.js.map