/**
 * Resolves an incoming request to the plan that governs it, and meters usage
 * against that plan's quota.
 *
 * Precedence, highest first:
 *   1. SELF_HOSTED_UNLIMITED=true  — everything unlocked, nothing metered
 *   2. A valid license key on the request
 *   3. Free
 *
 * Attached to every request as `req.entitlement` by the middleware below, so
 * controllers never re-derive it.
 */

import crypto from 'crypto';
import { getPlan, DEFAULT_PLAN_ID, SELF_HOSTED_PLAN, publicPlanShape } from './plans.js';
import { verifyLicenseKey } from './license.js';

/**
 * Self-hosters are not customers. The MIT licence gives them the code; metering
 * their own hardware would be hostile and trivially patched out anyway.
 */
export const IS_SELF_HOSTED = process.env.SELF_HOSTED_UNLIMITED === 'true';

/** Where a license key may arrive. Header is the normal path. */
const readLicenseKey = (req) =>
    req.headers?.['x-stash-license'] ||
    req.body?.license_key ||
    req.query?.license_key ||
    null;

/**
 * Resolve the plan governing this request.
 * Never throws: an invalid key degrades to free rather than failing the upload,
 * and the reason is surfaced so the UI can explain itself.
 */
export const resolveEntitlement = (req) => {
    if (IS_SELF_HOSTED) {
        return {
            plan: SELF_HOSTED_PLAN,
            planId: SELF_HOSTED_PLAN.id,
            limits: SELF_HOSTED_PLAN.limits,
            selfHosted: true,
            licensed: false,
            expiresAt: null,
            licenseError: null,
        };
    }

    const key = readLicenseKey(req);
    if (key) {
        const result = verifyLicenseKey(key);
        if (result.valid) {
            return {
                plan: result.plan,
                planId: result.planId,
                limits: result.plan.limits,
                selfHosted: false,
                licensed: true,
                expiresAt: result.expiresAt,
                licenseError: null,
            };
        }
        const freePlan = getPlan(DEFAULT_PLAN_ID);
        return {
            plan: freePlan,
            planId: freePlan.id,
            limits: freePlan.limits,
            selfHosted: false,
            licensed: false,
            expiresAt: null,
            licenseError: result.reason,
        };
    }

    const freePlan = getPlan(DEFAULT_PLAN_ID);
    return {
        plan: freePlan,
        planId: freePlan.id,
        limits: freePlan.limits,
        selfHosted: false,
        licensed: false,
        expiresAt: null,
        licenseError: null,
    };
};

/** Express middleware. Mounted once, before the routes that care. */
export const attachEntitlement = (req, res, next) => {
    req.entitlement = resolveEntitlement(req);
    next();
};

/* ------------------------------------------------------------------ *
 * Usage metering
 * ------------------------------------------------------------------ */

/**
 * Rolling 24h upload volume, keyed by license key (paid) or hashed IP (free).
 *
 * In-memory for the same reason state.js is: this server is single-instance by
 * design today. The consequence is that a restart forgives outstanding quota
 * and a second instance would not share counters, so this must move to Redis or
 * a `usage` table at the same time the socket state does. It is a revenue
 * guard, not a security boundary — the hard per-file cap in multer is what
 * actually protects the process.
 */
const usageByBucket = new Map(); // bucketKey -> { bytes, windowStart }

const USAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Identify the quota bucket without storing anything personally identifying. */
export const usageBucketKey = (req) => {
    const key = readLicenseKey(req);
    if (key) {
        return `lic:${crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 24)}`;
    }
    const ip = req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1';
    return `ip:${crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 24)}`;
};

const readBucket = (bucketKey) => {
    const now = Date.now();
    const existing = usageByBucket.get(bucketKey);
    if (!existing || now - existing.windowStart >= USAGE_WINDOW_MS) {
        const fresh = { bytes: 0, windowStart: now };
        usageByBucket.set(bucketKey, fresh);
        return fresh;
    }
    return existing;
};

/**
 * Would adding `bytes` exceed the plan's daily allowance?
 * @returns {{ allowed: boolean, used: number, limit: number|null, remaining: number|null }}
 */
export const checkQuota = (req, bytes) => {
    const limit = req.entitlement?.limits?.dailyUploadBytes ?? null;
    if (limit === null) {
        return { allowed: true, used: 0, limit: null, remaining: null };
    }
    const bucket = readBucket(usageBucketKey(req));
    const projected = bucket.bytes + bytes;
    return {
        allowed: projected <= limit,
        used: bucket.bytes,
        limit,
        remaining: Math.max(0, limit - bucket.bytes),
    };
};

/** Commit usage. Called only after an upload actually succeeds. */
export const recordUsage = (req, bytes) => {
    if (req.entitlement?.limits?.dailyUploadBytes === null) return;
    const bucket = readBucket(usageBucketKey(req));
    bucket.bytes += bytes;
};

/** Current usage snapshot, for the entitlement endpoint. */
export const getUsage = (req) => {
    const limit = req.entitlement?.limits?.dailyUploadBytes ?? null;
    const bucket = readBucket(usageBucketKey(req));
    return {
        usedBytes: bucket.bytes,
        limitBytes: limit,
        remainingBytes: limit === null ? null : Math.max(0, limit - bucket.bytes),
        resetsAt: bucket.windowStart + USAGE_WINDOW_MS,
    };
};

/** Drop stale buckets so the map does not grow without bound. */
export const pruneUsage = () => {
    const now = Date.now();
    for (const [key, bucket] of usageByBucket) {
        if (now - bucket.windowStart >= USAGE_WINDOW_MS) {
            usageByBucket.delete(key);
        }
    }
};

/** Test seam — lets the suite start from a known state. */
export const __resetUsage = () => usageByBucket.clear();

/** The shape returned by GET /api/billing/me. */
export const entitlementResponse = (req) => {
    const e = req.entitlement;
    return {
        plan: publicPlanShape(e.plan),
        licensed: e.licensed,
        selfHosted: e.selfHosted,
        expiresAt: e.expiresAt,
        licenseError: e.licenseError,
        usage: getUsage(req),
    };
};
