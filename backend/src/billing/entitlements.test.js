import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

process.env.LICENSE_SECRET = 'l'.repeat(64);
process.env.TOKEN_SECRET = 'a'.repeat(64);
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-service-key';

vi.mock('../supabase.js', () => ({ supabase: {} }));

let resolveEntitlement, attachEntitlement, checkQuota, recordUsage, __resetUsage;
let generateLicenseKey;
let PLANS;

const MB = 1024 * 1024;
const future = () => Date.now() + 30 * 24 * 60 * 60 * 1000;

/** Minimal Express-request stand-in. */
const makeReq = (overrides = {}) => ({
    headers: {},
    body: {},
    query: {},
    ip: '203.0.113.9',
    ...overrides,
});

beforeAll(async () => {
    ({ resolveEntitlement, attachEntitlement, checkQuota, recordUsage, __resetUsage } =
        await import('./entitlements.js'));
    ({ generateLicenseKey } = await import('./license.js'));
    ({ PLANS } = await import('./plans.js'));
});

beforeEach(() => __resetUsage());

describe('plan resolution', () => {
    it('defaults to free with no license key', () => {
        expect(resolveEntitlement(makeReq()).planId).toBe('free');
    });

    it('upgrades on a valid license key in the header', () => {
        const key = generateLicenseKey('pro', future());
        const e = resolveEntitlement(makeReq({ headers: { 'x-stash-license': key } }));
        expect(e.planId).toBe('pro');
        expect(e.licensed).toBe(true);
    });

    it('accepts a license key from the body or query too', () => {
        const key = generateLicenseKey('team', future());
        expect(resolveEntitlement(makeReq({ body: { license_key: key } })).planId).toBe('team');
        expect(resolveEntitlement(makeReq({ query: { license_key: key } })).planId).toBe('team');
    });

    // An invalid key must not break the upload, only decline to upgrade it.
    it('falls back to free on an invalid key and explains why', () => {
        const e = resolveEntitlement(makeReq({ headers: { 'x-stash-license': 'STASH-PRO-NOPE' } }));
        expect(e.planId).toBe('free');
        expect(e.licenseError).toBeTruthy();
    });

    it('attaches the entitlement to the request', () => {
        const req = makeReq();
        const next = vi.fn();
        attachEntitlement(req, {}, next);
        expect(req.entitlement.planId).toBe('free');
        expect(next).toHaveBeenCalled();
    });
});

describe('daily upload quota', () => {
    const freeReq = () => {
        const req = makeReq();
        attachEntitlement(req, {}, () => {});
        return req;
    };

    it('allows an upload inside the allowance', () => {
        expect(checkQuota(freeReq(), 10 * MB).allowed).toBe(true);
    });

    it('blocks an upload that would exceed the allowance', () => {
        const req = freeReq();
        expect(checkQuota(req, PLANS.free.limits.dailyUploadBytes + 1).allowed).toBe(false);
    });

    it('accumulates usage across uploads from the same client', () => {
        const req = freeReq();
        const limit = PLANS.free.limits.dailyUploadBytes;
        recordUsage(req, limit - MB);
        expect(checkQuota(req, MB).allowed).toBe(true);
        expect(checkQuota(req, 2 * MB).allowed).toBe(false);
    });

    it('meters separate IPs separately', () => {
        const a = makeReq({ ip: '203.0.113.1' });
        const b = makeReq({ ip: '203.0.113.2' });
        attachEntitlement(a, {}, () => {});
        attachEntitlement(b, {}, () => {});
        recordUsage(a, PLANS.free.limits.dailyUploadBytes);
        expect(checkQuota(a, MB).allowed).toBe(false);
        expect(checkQuota(b, MB).allowed).toBe(true);
    });

    // Paid quota follows the key, not the network, so a customer keeps their
    // allowance when they move between wifi and cellular.
    it('meters a licensed client by key rather than IP', () => {
        const key = generateLicenseKey('pro', future());
        const home = makeReq({ headers: { 'x-stash-license': key }, ip: '203.0.113.1' });
        const cafe = makeReq({ headers: { 'x-stash-license': key }, ip: '198.51.100.7' });
        attachEntitlement(home, {}, () => {});
        attachEntitlement(cafe, {}, () => {});

        recordUsage(home, 50 * 1024 * MB);
        expect(checkQuota(cafe, MB).used).toBe(50 * 1024 * MB);
    });

    it('gives a paid plan a larger allowance than free', () => {
        const key = generateLicenseKey('pro', future());
        const req = makeReq({ headers: { 'x-stash-license': key } });
        attachEntitlement(req, {}, () => {});
        const overFree = PLANS.free.limits.dailyUploadBytes + MB;
        expect(checkQuota(req, overFree).allowed).toBe(true);
    });

    it('resets the allowance once the 24h window rolls over', () => {
        const req = freeReq();
        recordUsage(req, PLANS.free.limits.dailyUploadBytes);
        expect(checkQuota(req, MB).allowed).toBe(false);

        const tomorrow = Date.now() + 25 * 60 * 60 * 1000;
        vi.spyOn(Date, 'now').mockReturnValue(tomorrow);
        try {
            expect(checkQuota(req, MB).allowed).toBe(true);
        } finally {
            Date.now.mockRestore();
        }
    });
});
