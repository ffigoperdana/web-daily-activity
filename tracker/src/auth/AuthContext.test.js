import { describe, it, expect } from 'vitest';
import { decodeIdTokenEmail, isOwner } from './AuthContext';
// Helper to create a fake JWT with a given payload
function fakeJwt(payload) {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const signature = 'fake-signature';
    return `${header}.${body}.${signature}`;
}
describe('decodeIdTokenEmail', () => {
    it('extracts email from a valid JWT payload', () => {
        const token = fakeJwt({ email: 'owner@example.com', sub: '12345' });
        expect(decodeIdTokenEmail(token)).toBe('owner@example.com');
    });
    it('returns null when email claim is missing', () => {
        const token = fakeJwt({ sub: '12345' });
        expect(decodeIdTokenEmail(token)).toBeNull();
    });
    it('returns null for malformed token (not 3 parts)', () => {
        expect(decodeIdTokenEmail('not-a-jwt')).toBeNull();
        expect(decodeIdTokenEmail('a.b')).toBeNull();
        expect(decodeIdTokenEmail('')).toBeNull();
    });
    it('returns null for invalid base64 payload', () => {
        expect(decodeIdTokenEmail('header.!!!invalid!!!.sig')).toBeNull();
    });
    it('handles base64url characters (- and _)', () => {
        // Create a payload that when base64-encoded uses + and /
        const payload = { email: 'test+special@example.com' };
        const token = fakeJwt(payload);
        expect(decodeIdTokenEmail(token)).toBe('test+special@example.com');
    });
});
describe('isOwner', () => {
    it('returns true for exact match', () => {
        expect(isOwner('owner@example.com', 'owner@example.com')).toBe(true);
    });
    it('returns true for case-insensitive match', () => {
        expect(isOwner('Owner@Example.COM', 'owner@example.com')).toBe(true);
        expect(isOwner('owner@example.com', 'OWNER@EXAMPLE.COM')).toBe(true);
    });
    it('returns false for different emails', () => {
        expect(isOwner('other@example.com', 'owner@example.com')).toBe(false);
    });
    it('returns false for empty strings', () => {
        expect(isOwner('', 'owner@example.com')).toBe(false);
        expect(isOwner('owner@example.com', '')).toBe(false);
    });
});
//# sourceMappingURL=AuthContext.test.js.map