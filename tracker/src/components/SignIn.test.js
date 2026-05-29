import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignIn } from './SignIn';
// Mock useAuth
const mockAuth = {
    status: 'signed-out',
    email: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getValidAccessToken: vi.fn(),
    getIdToken: vi.fn(),
    retryInit: vi.fn(),
};
vi.mock('../auth/AuthContext', () => ({
    useAuth: () => mockAuth,
}));
describe('SignIn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.status = 'signed-out';
        mockAuth.email = null;
        mockAuth.signIn = vi.fn().mockResolvedValue(undefined);
        mockAuth.retryInit = vi.fn();
    });
    it('renders loading indicator when status is loading', () => {
        mockAuth.status = 'loading';
        render(_jsx(SignIn, {}));
        expect(screen.getByTestId('sign-in-loading')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });
    it('renders sign-in button when status is signed-out', () => {
        mockAuth.status = 'signed-out';
        render(_jsx(SignIn, {}));
        expect(screen.getByRole('button', { name: 'Masuk dengan Google' })).toBeInTheDocument();
    });
    it('calls signIn when button is clicked', async () => {
        mockAuth.status = 'signed-out';
        render(_jsx(SignIn, {}));
        fireEvent.click(screen.getByRole('button', { name: 'Masuk dengan Google' }));
        await waitFor(() => {
            expect(mockAuth.signIn).toHaveBeenCalledTimes(1);
        });
    });
    it('shows error message when signIn fails', async () => {
        mockAuth.status = 'signed-out';
        mockAuth.signIn = vi.fn().mockRejectedValue(new Error('popup_closed'));
        render(_jsx(SignIn, {}));
        fireEvent.click(screen.getByRole('button', { name: 'Masuk dengan Google' }));
        await waitFor(() => {
            expect(screen.getByTestId('sign-in-error')).toHaveTextContent('popup_closed');
        });
    });
    it('renders init-failed view with error message and retry button', () => {
        mockAuth.status = 'init-failed';
        render(_jsx(SignIn, {}));
        expect(screen.getByTestId('sign-in-init-failed')).toBeInTheDocument();
        expect(screen.getByText('gagal memulai login Google')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'coba lagi' })).toBeInTheDocument();
    });
    it('calls retryInit when coba lagi button is clicked', () => {
        mockAuth.status = 'init-failed';
        render(_jsx(SignIn, {}));
        fireEvent.click(screen.getByRole('button', { name: 'coba lagi' }));
        expect(mockAuth.retryInit).toHaveBeenCalledTimes(1);
    });
    it('renders forbidden view with akun tidak diizinkan message', () => {
        mockAuth.status = 'forbidden';
        render(_jsx(SignIn, {}));
        expect(screen.getByTestId('sign-in-forbidden')).toBeInTheDocument();
        expect(screen.getByText('akun tidak diizinkan')).toBeInTheDocument();
    });
    it('clears error on subsequent sign-in attempt', async () => {
        mockAuth.status = 'signed-out';
        mockAuth.signIn = vi.fn().mockRejectedValueOnce(new Error('first error')).mockResolvedValueOnce(undefined);
        render(_jsx(SignIn, {}));
        // First click - error
        fireEvent.click(screen.getByRole('button', { name: 'Masuk dengan Google' }));
        await waitFor(() => {
            expect(screen.getByTestId('sign-in-error')).toBeInTheDocument();
        });
        // Second click - success, error cleared
        fireEvent.click(screen.getByRole('button', { name: 'Masuk dengan Google' }));
        await waitFor(() => {
            expect(screen.queryByTestId('sign-in-error')).not.toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=SignIn.test.js.map