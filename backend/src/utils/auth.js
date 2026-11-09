import crypto from 'crypto';
import dotenv from 'dotenv';
import { supabase } from '../supabase.js';

dotenv.config();

// Use a dedicated TOKEN_SECRET, distinct from the Supabase service key.
// There is deliberately no fallback: a hardcoded default in a public repo means
// anyone can forge room and host tokens, and silently reusing the Supabase
// service key conflates two unrelated secrets.
const TOKEN_SECRET = process.env.TOKEN_SECRET;

if (!TOKEN_SECRET || TOKEN_SECRET.length < 32) {
    console.error(
        'CRITICAL: TOKEN_SECRET is missing or shorter than 32 characters.\n' +
        'Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        'and set it in backend/.env before starting the server.'
    );
    process.exit(1);
}

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours validity

/**
 * Generate a stateless signed token with timestamp for a room and client ID combination
 */
export const generateRoomToken = (roomId, clientId) => {
    const cleanRoomId = String(roomId).trim();
    const cleanClientId = String(clientId).trim();
    const timestamp = Date.now();
    const payload = `${cleanRoomId}:${cleanClientId}:${timestamp}`;
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return `${payload}:${signature}`;
};

/**
 * Verify if the provided token matches the roomId, was signed by this server, and has not expired
 */
export const verifyRoomToken = (token, roomId) => {
    if (!token || typeof token !== 'string') return false;
    try {
        const parts = token.split(':');
        if (parts.length !== 4) return false;
        const [tRoomId, tClientId, tTimestampStr, signature] = parts;
        if (tRoomId !== roomId) return false;

        const timestamp = parseInt(tTimestampStr, 10);
        if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_MS) {
            return false; // Token expired
        }

        const expectedPayload = `${tRoomId}:${tClientId}:${tTimestampStr}`;
        const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(expectedPayload).digest('hex');

        const sigBuf = Buffer.from(signature, 'hex');
        const expectedSigBuf = Buffer.from(expectedSig, 'hex');

        if (sigBuf.length !== expectedSigBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expectedSigBuf);
    } catch {
        return false;
    }
};

/**
 * Generate a signed host token proving ownership of a room.
 *
 * This exists because `x-host-id` is a client-invented string from localStorage:
 * anyone who learns a room's creator id could previously send it as a header and
 * gain host powers. A host token can only be produced by this server.
 */
export const generateHostToken = (roomId) => {
    const cleanRoomId = String(roomId).trim();
    const timestamp = Date.now();
    const payload = `host:${cleanRoomId}:${timestamp}`;
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return `${payload}:${signature}`;
};

/**
 * Verify a host token for a room. Host tokens do not expire: losing host rights
 * on a 24h-lived room because a tab was open too long is worse than the marginal
 * risk, and the room itself is pruned after a day.
 */
export const verifyHostToken = (token, roomId) => {
    if (!token || typeof token !== 'string') return false;
    try {
        const parts = token.split(':');
        if (parts.length !== 4) return false;
        const [prefix, tRoomId, tTimestampStr, signature] = parts;
        if (prefix !== 'host') return false;
        if (tRoomId !== String(roomId).trim()) return false;

        const expectedPayload = `host:${tRoomId}:${tTimestampStr}`;
        const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(expectedPayload).digest('hex');

        const sigBuf = Buffer.from(signature, 'hex');
        const expectedSigBuf = Buffer.from(expectedSig, 'hex');

        if (sigBuf.length !== expectedSigBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expectedSigBuf);
    } catch {
        return false;
    }
};

/**
 * Resolve whether the caller is the verified host of a room.
 * Accepts only a server-signed host token — never a bare client id.
 */
export const isVerifiedHost = (req, roomId) => {
    const hostToken = req.headers['x-host-token'] || req.body?.host_token || req.query?.host_token;
    return verifyHostToken(hostToken, roomId);
};

/**
 * Express middleware to check if the user has access to the specified room.
 * Resolves room_id from params, body, or headers.
 */
export const checkRoomAccess = async (req, res, next) => {
    try {
        const roomId = req.params.room_id || req.body.room_id || req.query.room_id;
        if (!roomId) {
            return res.status(400).json({ status: 'error', message: 'Room ID is required.' });
        }

        // Fetch room details
        const { data: room, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();

        if (error) throw error;

        // If the room doesn't exist, allow for creation routes
        if (!room) {
            return next();
        }

        // If the room is open (not protected, no key, not accept_only), access is public
        const hasNoSecurity = !room.is_protected && !room.stack_key_hash && !room.accept_only;
        if (hasNoSecurity) {
            return next();
        }

        // Host verification — requires a server-signed host token, not a client id
        if (isVerifiedHost(req, roomId)) {
            return next();
        }

        // Token verification
        const token = req.headers['x-room-access-token'] || req.body.room_access_token || req.query.token;
        if (token && verifyRoomToken(token, roomId)) {
            return next();
        }

        // Client is unauthorized
        return res.status(401).json({
            status: 'unauthorized',
            message: 'Authentication required for this room.',
            data: {
                room: {
                    id: room.id,
                    name: room.name,
                    description: room.description,
                    is_protected: room.is_protected,
                    accept_only: room.accept_only,
                    has_stack_key: !!room.stack_key
                }
            }
        });
    } catch (err) {
        next(err);
    }
};
