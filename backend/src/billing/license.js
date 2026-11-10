/**
 * License keys — stateless, HMAC-signed, verified offline.
 *
 * Deliberately modelled on utils/auth.js rather than on a users table. Stash's
 * entire pitch is "no account, no email, no sign-up"; bolting a login onto it
 * to collect $6 would damage the product more than the revenue is worth. A
 * license key is a bearer credential: paste it once, it lives in localStorage,
 * it proves a plan without naming a person.
 *
 * Format:  STASH-<PLAN>-<BASE32 PAYLOAD>-<SIG>
 * Payload: planId:expiresAt:nonce          (colon-separated, base32url encoded)
 *
 * Consequences of bearer keys, accepted knowingly:
 *   - A shared key works for whoever holds it. Seat enforcement is a Team-tier
 *     concern and is handled by the per-key daily quota, not by identity.
 *   - A key cannot be revoked by signature alone, so a revocation list is
 *     checked too (see isRevoked). That list is the only stateful part.
 */

import crypto from 'crypto';
import { PAID_PLAN_IDS, getPlan } from './plans.js';

/**
 * Signing secret for license keys. Separate from TOKEN_SECRET on purpose: room
 * tokens are issued constantly to anonymous visitors, licenses are money. A
 * leak of one must not mint the other.
 *
 * Falls back to TOKEN_SECRET so that a self-hosted instance — which has nothing
 * to sell and no keys to mint — still boots with one secret configured.
 */
const LICENSE_SECRET = process.env.LICENSE_SECRET || process.env.TOKEN_SECRET;

const KEY_PREFIX = 'STASH';

/** Crockford-style base32 without I/L/O/U, so keys survive being read aloud. */
const B32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const base32Encode = (buf) => {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        out += B32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return out;
};

const base32Decode = (str) => {
    let bits = 0;
    let value = 0;
    const out = [];
    for (const char of str.toUpperCase()) {
        const idx = B32_ALPHABET.indexOf(char);
        if (idx === -1) throw new Error('invalid base32 character');
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
};

const sign = (payload) =>
    crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest();

/** Group into 5-char blocks so a key can be typed without losing your place. */
const group = (str, size = 5) => (str.match(new RegExp(`.{1,${size}}`, 'g')) || []).join('-');

/**
 * Mint a license key.
 *
 * @param {string} planId        'pro' | 'team'
 * @param {number} expiresAt     epoch ms; the end of the paid period
 * @returns {string} the key to hand to the customer
 */
export const generateLicenseKey = (planId, expiresAt) => {
    if (!LICENSE_SECRET || LICENSE_SECRET.length < 32) {
        throw new Error('LICENSE_SECRET (or TOKEN_SECRET) must be at least 32 characters to mint license keys.');
    }
    if (!PAID_PLAN_IDS.includes(planId)) {
        throw new Error(`Cannot mint a license for plan "${planId}".`);
    }

    const nonce = crypto.randomBytes(6).toString('hex');
    const payload = `${planId}:${expiresAt}:${nonce}`;
    const body = base32Encode(Buffer.from(payload, 'utf8'));
    // 10 signature bytes = 80 bits. Forging one at ~60 keys/15min (the billing
    // rate limit) is not a threat worth a longer key for.
    const sig = base32Encode(sign(payload).subarray(0, 10));

    return `${KEY_PREFIX}-${planId.toUpperCase()}-${group(body)}-${group(sig)}`;
};

/** Strip formatting so users can paste keys with or without the dashes. */
const normalize = (key) => String(key || '').trim().toUpperCase().replace(/[\s-]/g, '');

/**
 * Verify a license key and return what it entitles the holder to.
 *
 * @returns {{ valid: boolean, planId?: string, expiresAt?: number, reason?: string }}
 */
export const verifyLicenseKey = (key) => {
    if (!LICENSE_SECRET || LICENSE_SECRET.length < 32) {
        return { valid: false, reason: 'Licensing is not configured on this server.' };
    }

    const flat = normalize(key);
    if (!flat.startsWith(KEY_PREFIX)) {
        return { valid: false, reason: 'That does not look like a Stash license key.' };
    }

    // After normalisation the plan name and dashes are gone, so the payload is
    // recovered from the signature length rather than by splitting on '-'.
    const afterPrefix = flat.slice(KEY_PREFIX.length);
    const planId = PAID_PLAN_IDS.find((p) => afterPrefix.startsWith(p.toUpperCase()));
    if (!planId) {
        return { valid: false, reason: 'Unknown plan in license key.' };
    }

    const rest = afterPrefix.slice(planId.length);
    const SIG_CHARS = 16; // 10 bytes -> 16 base32 chars
    if (rest.length <= SIG_CHARS) {
        return { valid: false, reason: 'License key is truncated.' };
    }

    const bodyPart = rest.slice(0, rest.length - SIG_CHARS);
    const sigPart = rest.slice(rest.length - SIG_CHARS);

    let payload;
    let providedSig;
    try {
        payload = base32Decode(bodyPart).toString('utf8');
        providedSig = base32Decode(sigPart);
    } catch {
        return { valid: false, reason: 'License key is malformed.' };
    }

    const expectedSig = sign(payload).subarray(0, 10);
    if (
        providedSig.length !== expectedSig.length ||
        !crypto.timingSafeEqual(providedSig, expectedSig)
    ) {
        return { valid: false, reason: 'License key signature is not valid.' };
    }

    const [keyPlanId, expiresAtStr] = payload.split(':');
    if (keyPlanId !== planId) {
        return { valid: false, reason: 'License key plan mismatch.' };
    }

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt)) {
        return { valid: false, reason: 'License key has no valid expiry.' };
    }
    if (Date.now() > expiresAt) {
        return { valid: false, reason: 'This license has expired. Renew to restore your plan.', expired: true };
    }
    if (isRevoked(key)) {
        return { valid: false, reason: 'This license has been revoked.' };
    }

    return { valid: true, planId, expiresAt, plan: getPlan(planId) };
};

/**
 * Revocation list for refunds and chargebacks.
 *
 * Read from REVOKED_LICENSE_KEYS (comma-separated) so a key can be killed by a
 * config change and a restart, with no migration. If this ever grows past a
 * handful of entries it should move to a `revoked_licenses` table — at that
 * point the lookup belongs in the database, not in an env var.
 */
const revokedKeys = new Set(
    (process.env.REVOKED_LICENSE_KEYS || '')
        .split(',')
        .map((k) => normalize(k))
        .filter(Boolean)
);

export const isRevoked = (key) => revokedKeys.has(normalize(key));

/** Exposed for the admin path so a refund can take effect without a restart. */
export const revokeLicenseKey = (key) => {
    const flat = normalize(key);
    if (!flat) return false;
    revokedKeys.add(flat);
    return true;
};
