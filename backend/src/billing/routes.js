/**
 * Billing endpoints.
 *
 * Payment provider: Lemon Squeezy / Paddle style — a merchant of record that
 * handles VAT and sales tax for a solo developer selling worldwide. Stripe
 * would require registering for tax in every jurisdiction that sells; an MoR
 * takes that liability. The webhook contract below is provider-agnostic: it
 * needs an event name, a plan id and an email to send the key to.
 *
 * Nothing here stores a customer record. The webhook mints a signed key and
 * returns/sends it; the key *is* the subscription state.
 */

import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';
import { PLANS, publicPlanShape, PAID_PLAN_IDS, getPlan } from './plans.js';
import { generateLicenseKey, verifyLicenseKey, revokeLicenseKey } from './license.js';
import { attachEntitlement, entitlementResponse, IS_SELF_HOSTED } from './entitlements.js';

const router = express.Router();

/** Key operations are brute-forceable by nature, so they get their own limit. */
const licenseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many license attempts. Try again in a few minutes.' },
});

/* ------------------------------------------------------------------ *
 * Public pricing
 * ------------------------------------------------------------------ */

router.get('/plans', (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            plans: Object.values(PLANS).map(publicPlanShape),
            selfHosted: IS_SELF_HOSTED,
            checkoutConfigured: Boolean(process.env.CHECKOUT_URL_PRO || process.env.CHECKOUT_URL_TEAM),
        },
    });
});

/* ------------------------------------------------------------------ *
 * What am I entitled to?
 * ------------------------------------------------------------------ */

router.get('/me', attachEntitlement, (req, res) => {
    res.status(200).json({ status: 'success', data: entitlementResponse(req) });
});

/**
 * Validate a key without applying it, so the UI can say "that worked" at the
 * moment of pasting rather than at the next upload.
 */
router.post('/redeem', licenseLimiter, (req, res, next) => {
    const { license_key: licenseKey } = req.body || {};
    if (!licenseKey || typeof licenseKey !== 'string') {
        return next(new AppError('A license key is required.', 400));
    }

    const result = verifyLicenseKey(licenseKey);
    if (!result.valid) {
        return next(new AppError(result.reason || 'That license key is not valid.', 400));
    }

    res.status(200).json({
        status: 'success',
        data: {
            plan: publicPlanShape(result.plan),
            expiresAt: result.expiresAt,
        },
    });
});

/* ------------------------------------------------------------------ *
 * Checkout hand-off
 * ------------------------------------------------------------------ */

/**
 * Returns the hosted checkout URL for a plan. The provider owns the payment
 * page, so Stash never sees a card number and stays out of PCI scope.
 */
router.get('/checkout/:plan_id', (req, res, next) => {
    const planId = String(req.params.plan_id || '').toLowerCase();
    if (!PAID_PLAN_IDS.includes(planId)) {
        return next(new AppError('Unknown plan.', 404));
    }

    const url = planId === 'pro' ? process.env.CHECKOUT_URL_PRO : process.env.CHECKOUT_URL_TEAM;
    if (!url) {
        return next(new AppError(
            'Checkout is not configured on this instance. Set CHECKOUT_URL_PRO / CHECKOUT_URL_TEAM.',
            503
        ));
    }

    res.status(200).json({
        status: 'success',
        data: { url, plan: publicPlanShape(getPlan(planId)) },
    });
});

/* ------------------------------------------------------------------ *
 * Provider webhook
 * ------------------------------------------------------------------ */

/**
 * Verify the provider's HMAC over the *raw* request body.
 *
 * server.js mounts express.raw() for this path specifically. Re-serialising a
 * parsed body with JSON.stringify would reorder keys and change whitespace, and
 * the signature would never match.
 */
const verifyWebhookSignature = (req) => {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: 'BILLING_WEBHOOK_SECRET is not set.' };

    const provided =
        req.headers['x-signature'] ||
        req.headers['x-webhook-signature'] ||
        req.headers['paddle-signature'];

    if (!provided) return { ok: false, reason: 'Missing signature header.' };

    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    const providedBuf = Buffer.from(String(provided), 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (providedBuf.length !== expectedBuf.length) {
        return { ok: false, reason: 'Signature mismatch.' };
    }
    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
        return { ok: false, reason: 'Signature mismatch.' };
    }
    return { ok: true, raw };
};

const PERIOD_MS = {
    month: 31 * 24 * 60 * 60 * 1000,
    year: 366 * 24 * 60 * 60 * 1000,
};

/**
 * Subscription lifecycle. Keys are minted for one billing period plus a short
 * grace margin; a renewal event mints the next one. If a renewal never
 * arrives the key simply lapses, which is the correct end state for a
 * cancelled subscription and needs no separate cancellation handling.
 */
router.post('/webhook', (req, res, next) => {
    try {
        const sig = verifyWebhookSignature(req);
        if (!sig.ok) {
            return next(new AppError(`Webhook rejected: ${sig.reason}`, 401));
        }

        let event;
        try {
            event = JSON.parse(sig.raw.toString('utf8'));
        } catch {
            return next(new AppError('Webhook body is not valid JSON.', 400));
        }

        const eventName = event?.meta?.event_name || event?.event_type || event?.type;
        const custom = event?.meta?.custom_data || event?.custom_data || {};
        const planId = String(custom.plan_id || custom.plan || 'pro').toLowerCase();
        const interval = String(custom.interval || 'month').toLowerCase();

        if (!PAID_PLAN_IDS.includes(planId)) {
            return next(new AppError(`Webhook names an unknown plan: ${planId}`, 400));
        }

        const CREATE_EVENTS = [
            'order_created',
            'subscription_created',
            'subscription_payment_success',
            'subscription.activated',
            'transaction.completed',
        ];
        const REVOKE_EVENTS = ['subscription_refunded', 'order_refunded', 'adjustment.updated'];

        if (REVOKE_EVENTS.includes(eventName)) {
            const key = custom.license_key || event?.data?.attributes?.license_key;
            if (key) revokeLicenseKey(key);
            return res.status(200).json({ status: 'success', data: { revoked: Boolean(key) } });
        }

        if (!CREATE_EVENTS.includes(eventName)) {
            // Acknowledge anything else so the provider stops retrying.
            return res.status(200).json({ status: 'success', data: { ignored: eventName || 'unknown' } });
        }

        // One period, plus 2 days so a late renewal webhook does not briefly
        // downgrade a paying customer.
        const periodMs = PERIOD_MS[interval] || PERIOD_MS.month;
        const expiresAt = Date.now() + periodMs + 2 * 24 * 60 * 60 * 1000;
        const licenseKey = generateLicenseKey(planId, expiresAt);

        // The provider emails the key via its own receipt template using this
        // response, so Stash still never stores an email address.
        console.log(`[billing] issued ${planId} license, expires ${new Date(expiresAt).toISOString()}`);

        return res.status(200).json({
            status: 'success',
            data: { license_key: licenseKey, plan: planId, expires_at: expiresAt },
        });
    } catch (err) {
        next(err);
    }
});

/* ------------------------------------------------------------------ *
 * Admin: mint a key by hand
 * ------------------------------------------------------------------ */

/**
 * For refunds, sponsorships, press and the maintainer's own testing. Guarded by
 * ADMIN_SECRET; if that is unset the route is disabled rather than open.
 */
router.post('/admin/mint', licenseLimiter, (req, res, next) => {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || adminSecret.length < 16) {
        return next(new AppError('Admin minting is disabled on this instance.', 503));
    }

    const provided = req.headers['x-admin-secret'];
    const a = Buffer.from(String(provided || ''), 'utf8');
    const b = Buffer.from(adminSecret, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return next(new AppError('Not authorized.', 401));
    }

    const planId = String(req.body?.plan_id || 'pro').toLowerCase();
    if (!PAID_PLAN_IDS.includes(planId)) {
        return next(new AppError('Unknown plan.', 400));
    }

    const days = Math.min(Math.max(parseInt(req.body?.days, 10) || 31, 1), 3650);
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;

    res.status(201).json({
        status: 'success',
        data: {
            license_key: generateLicenseKey(planId, expiresAt),
            plan: planId,
            expires_at: expiresAt,
        },
    });
});

export default router;
