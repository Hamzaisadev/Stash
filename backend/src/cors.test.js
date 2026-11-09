import { describe, it, expect } from 'vitest';

/**
 * Mirrors the origin policy in server.js.
 *
 * Kept as a standalone implementation because server.js binds a port and starts
 * timers at import time. If the policy in server.js changes, change it here too
 * — the point of these cases is to pin down the behaviour that regressed:
 * every branch used to return "allowed", including the fallback, so the
 * allowlist did nothing.
 */
const makeIsOriginAllowed = ({ isDev, allowedOrigins }) => (origin) => {
    if (!origin) return true;
    if (isDev) return true;
    return allowedOrigins.includes(origin);
};

describe('CORS origin policy in production', () => {
    const isOriginAllowed = makeIsOriginAllowed({
        isDev: false,
        allowedOrigins: ['https://stash-ed.vercel.app', 'https://stash.example.com'],
    });

    it('allows configured origins', () => {
        expect(isOriginAllowed('https://stash-ed.vercel.app')).toBe(true);
        expect(isOriginAllowed('https://stash.example.com')).toBe(true);
    });

    it('rejects unknown origins', () => {
        expect(isOriginAllowed('https://evil.example')).toBe(false);
    });

    // Previously any *.vercel.app was allowed, so anyone could point a free
    // Vercel deploy at this API and drive it from a page they controlled.
    it('rejects arbitrary vercel.app subdomains', () => {
        expect(isOriginAllowed('https://attacker-clone.vercel.app')).toBe(false);
    });

    it('rejects look-alike origins and scheme downgrades', () => {
        expect(isOriginAllowed('https://stash-ed.vercel.app.evil.example')).toBe(false);
        expect(isOriginAllowed('http://stash-ed.vercel.app')).toBe(false);
    });

    it('allows requests with no Origin header (curl, server-to-server)', () => {
        expect(isOriginAllowed(undefined)).toBe(true);
        expect(isOriginAllowed('')).toBe(true);
    });

    it('rejects everything when no origins are configured', () => {
        const strict = makeIsOriginAllowed({ isDev: false, allowedOrigins: [] });
        expect(strict('https://stash-ed.vercel.app')).toBe(false);
    });
});

describe('CORS origin policy in development', () => {
    it('allows any origin so local devices and LAN IPs work', () => {
        const isOriginAllowed = makeIsOriginAllowed({ isDev: true, allowedOrigins: [] });
        expect(isOriginAllowed('http://localhost:5173')).toBe(true);
        expect(isOriginAllowed('http://192.168.1.42:5173')).toBe(true);
    });
});
