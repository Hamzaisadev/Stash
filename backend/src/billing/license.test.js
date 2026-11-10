import { describe, it, expect, beforeAll, vi } from 'vitest';

// license.js reads LICENSE_SECRET at import time; set it before the dynamic
// import below, mirroring the pattern in utils/auth.test.js.
process.env.LICENSE_SECRET = 'l'.repeat(64);
process.env.TOKEN_SECRET = 'a'.repeat(64);
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-service-key';

vi.mock('../supabase.js', () => ({ supabase: {} }));

let generateLicenseKey, verifyLicenseKey, revokeLicenseKey;

const HOUR = 60 * 60 * 1000;
const future = () => Date.now() + 30 * 24 * HOUR;

beforeAll(async () => {
    const mod = await import('./license.js');
    ({ generateLicenseKey, verifyLicenseKey, revokeLicenseKey } = mod);
});

describe('license key issuance', () => {
    it('accepts a key it just minted', () => {
        const key = generateLicenseKey('pro', future());
        const result = verifyLicenseKey(key);
        expect(result.valid).toBe(true);
        expect(result.planId).toBe('pro');
    });

    it('round-trips the team plan too', () => {
        const key = generateLicenseKey('team', future());
        expect(verifyLicenseKey(key).planId).toBe('team');
    });

    it('refuses to mint a key for a free or unknown plan', () => {
        expect(() => generateLicenseKey('free', future())).toThrow();
        expect(() => generateLicenseKey('enterprise', future())).toThrow();
    });

    it('preserves the expiry it was minted with', () => {
        const expiresAt = future();
        expect(verifyLicenseKey(generateLicenseKey('pro', expiresAt)).expiresAt).toBe(expiresAt);
    });

    it('mints distinct keys for identical inputs', () => {
        const expiresAt = future();
        // The nonce exists so two customers buying the same plan in the same
        // millisecond do not receive the same key.
        expect(generateLicenseKey('pro', expiresAt)).not.toBe(generateLicenseKey('pro', expiresAt));
    });
});

describe('license key verification', () => {
    it('accepts a key with the dashes stripped or lowercased', () => {
        const key = generateLicenseKey('pro', future());
        expect(verifyLicenseKey(key.replace(/-/g, '')).valid).toBe(true);
        expect(verifyLicenseKey(key.toLowerCase()).valid).toBe(true);
        expect(verifyLicenseKey(`  ${key}  `).valid).toBe(true);
    });

    it('rejects a tampered signature', () => {
        const key = generateLicenseKey('pro', future());
        const mangled = key.slice(0, -1) + (key.slice(-1) === 'A' ? 'B' : 'A');
        expect(verifyLicenseKey(mangled).valid).toBe(false);
    });

    // The attack that matters: buy Pro, edit the key to say Team.
    it('rejects a key whose plan was upgraded by hand', () => {
        const key = generateLicenseKey('pro', future());
        expect(verifyLicenseKey(key.replace('PRO', 'TEAM')).valid).toBe(false);
    });

    it('rejects an expired key', () => {
        const key = generateLicenseKey('pro', Date.now() + HOUR);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * HOUR);
        try {
            const result = verifyLicenseKey(key);
            expect(result.valid).toBe(false);
            expect(result.expired).toBe(true);
        } finally {
            Date.now.mockRestore();
        }
    });

    it('rejects malformed and empty input without throwing', () => {
        for (const bad of ['', null, undefined, 'hello', 'STASH-PRO-ZZZZ', {}, 42, 'STASH-PRO-']) {
            expect(verifyLicenseKey(bad).valid).toBe(false);
        }
    });

    it('rejects a revoked key even though the signature is good', () => {
        const key = generateLicenseKey('pro', future());
        expect(verifyLicenseKey(key).valid).toBe(true);
        revokeLicenseKey(key);
        expect(verifyLicenseKey(key).valid).toBe(false);
    });

    it('revokes regardless of the formatting used to present the key', () => {
        const key = generateLicenseKey('team', future());
        revokeLicenseKey(key.toLowerCase().replace(/-/g, ''));
        expect(verifyLicenseKey(key).valid).toBe(false);
    });
});
