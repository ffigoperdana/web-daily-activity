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
        return (_jsx("div", { className: "sign-in-screen", "data-testid": "sign-in-loading", role: "status", "aria-busy": "true", children: _jsx("div", { className: "spinner" }) }));
    }
    if (status === 'init-failed') {
        return (_jsxs("div", { className: "sign-in-screen", "data-testid": "sign-in-init-failed", children: [_jsxs("div", { children: [_jsx("div", { className: "app-logo", children: "\uD83D\uDCCB" }), _jsx("h1", { children: "Daily Tracker" })] }), _jsx("div", { className: "alert alert-error", children: id.gagal_memulai_login_google }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: retryInit, children: id.coba_lagi })] }));
    }
    if (status === 'forbidden') {
        return (_jsxs("div", { className: "sign-in-screen", "data-testid": "sign-in-forbidden", children: [_jsxs("div", { children: [_jsx("div", { className: "app-logo", children: "\uD83D\uDEAB" }), _jsx("h1", { children: "Akses Ditolak" })] }), _jsx("div", { className: "alert alert-error", children: id.akun_tidak_diizinkan })] }));
    }
    return (_jsxs("div", { className: "sign-in-screen", "data-testid": "sign-in-screen", children: [_jsxs("div", { children: [_jsx("div", { className: "app-logo", children: "\uD83D\uDCCB" }), _jsx("h1", { children: "Daily Tracker" }), _jsx("p", { children: "Catat aktivitas harian ke Google Calendar" })] }), _jsxs("button", { type: "button", className: "btn btn-google", onClick: handleSignIn, children: [_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 18 18", fill: "none", children: [_jsx("path", { d: "M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z", fill: "#4285F4" }), _jsx("path", { d: "M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z", fill: "#34A853" }), _jsx("path", { d: "M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z", fill: "#FBBC05" }), _jsx("path", { d: "M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z", fill: "#EA4335" })] }), "Masuk dengan Google"] }), error && (_jsx("div", { className: "alert alert-error", "data-testid": "sign-in-error", role: "alert", children: error }))] }));
}
//# sourceMappingURL=SignIn.js.map