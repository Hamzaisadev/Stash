/**
 * Plan definitions — the single source of truth for every paid limit.
 *
 * Stash is MIT licensed, so the code itself cannot be sold. What is sold is the
 * *hosted* instance: bandwidth, storage, the TURN relay and the domain. Anyone
 * who self-hosts gets every limit below for free by setting
 * `SELF_HOSTED_UNLIMITED=true`, which is the honest reading of the licence and
 * also removes any incentive to crack the key format.
 *
 * Every number here is enforced server-side (see entitlements.js and the upload
 * path in controller.js). The frontend copy in frontend/src/data/pricing.js
 * mirrors these values and must be changed in lockstep — the landing page has a
 * hard rule that published numbers match the implementation.
 *
 * Prices are in the smallest currency unit (USD cents) to avoid float drift.
 */

const MB = 1024 * 1024;
const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * `null` always means "no limit". Checks are written so that a null short
 * circuits to allowed, rather than comparing against Infinity.
 */
export const PLANS = {
    free: {
        id: 'free',
        name: 'Free',
        priceCents: 0,
        interval: null,
        tagline: 'The whole product, for the everyday case.',
        limits: {
            maxFileBytes: 100 * MB,
            maxFilesPerUpload: 10,
            maxExpiryMinutes: 7 * DAY,
            maxRoomsPerHost: 10,
            maxRoomLifetimeHours: 24,
            // Rolling 24h upload volume per client. Generous enough that a
            // normal person never sees it; low enough that Stash is not free
            // hosting for someone's CDN.
            dailyUploadBytes: 2 * 1024 * MB,       // 2 GB
            clipboardHistory: 30,
            customRoomNames: true,
            passwordProtection: true,
            burnAfterDownload: true,
            screenShare: true,
            turnRelay: false,                      // STUN only on free
            apiAccess: false,
            customBranding: false,
            prioritySupport: false,
        },
    },

    pro: {
        id: 'pro',
        name: 'Pro',
        priceCents: 600,
        interval: 'month',
        tagline: 'For people who move big files all day.',
        limits: {
            maxFileBytes: 5 * 1024 * MB,           // 5 GB
            maxFilesPerUpload: 50,
            maxExpiryMinutes: 30 * DAY,
            maxRoomsPerHost: 100,
            maxRoomLifetimeHours: 30 * 24,
            dailyUploadBytes: 100 * 1024 * MB,     // 100 GB
            clipboardHistory: 500,
            customRoomNames: true,
            passwordProtection: true,
            burnAfterDownload: true,
            screenShare: true,
            turnRelay: true,
            apiAccess: true,
            customBranding: false,
            prioritySupport: true,
        },
    },

    team: {
        id: 'team',
        name: 'Team',
        priceCents: 2400,
        interval: 'month',
        tagline: 'Shared rooms, your logo, an audit trail.',
        limits: {
            maxFileBytes: 20 * 1024 * MB,          // 20 GB
            maxFilesPerUpload: 200,
            maxExpiryMinutes: 365 * DAY,
            maxRoomsPerHost: null,
            maxRoomLifetimeHours: null,
            dailyUploadBytes: 1024 * 1024 * MB,    // 1 TB
            clipboardHistory: 2000,
            customRoomNames: true,
            passwordProtection: true,
            burnAfterDownload: true,
            screenShare: true,
            turnRelay: true,
            apiAccess: true,
            customBranding: true,
            prioritySupport: true,
        },
    },
};

export const DEFAULT_PLAN_ID = 'free';

/** Plan ids that a license key is allowed to name. */
export const PAID_PLAN_IDS = ['pro', 'team'];

export const getPlan = (planId) => PLANS[planId] || PLANS[DEFAULT_PLAN_ID];

export const isPaidPlan = (planId) => PAID_PLAN_IDS.includes(planId);

/**
 * The plan a self-hosted instance runs on. Self-hosters own their own storage
 * and bandwidth, so metering them serves no one.
 */
export const SELF_HOSTED_PLAN = {
    ...PLANS.team,
    id: 'self-hosted',
    name: 'Self-hosted',
    priceCents: 0,
    interval: null,
    tagline: 'Your server, your rules, every limit lifted.',
    limits: {
        ...PLANS.team.limits,
        maxFileBytes: null,
        maxFilesPerUpload: 200,
        maxExpiryMinutes: null,
        dailyUploadBytes: null,
    },
};

/** Serialisable view of a plan for the public pricing/entitlement endpoints. */
export const publicPlanShape = (plan) => ({
    id: plan.id,
    name: plan.name,
    priceCents: plan.priceCents,
    interval: plan.interval,
    tagline: plan.tagline,
    limits: plan.limits,
});
