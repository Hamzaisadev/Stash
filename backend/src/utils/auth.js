import crypto from 'crypto';
import dotenv from 'dotenv';
import { supabase } from '../supabase.js';

dotenv.config();

const SECRET = process.env.SUPABASE_SECRET_KEY || 'stash-secret-fallback-key';

/**
 * Generate a stateless signed token for a room and client ID combination
 */
export const generateRoomToken = (roomId, clientId) => {
    const cleanRoomId = roomId.trim();
    const cleanClientId = clientId.trim();
    const data = `${cleanRoomId}:${cleanClientId}`;
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    return `${data}:${signature}`;
};

/**
 * Verify if the provided token matches the roomId and was signed by this server
 */
export const verifyRoomToken = (token, roomId) => {
    if (!token) return false;
    try {
        const parts = token.split(':');
        if (parts.length !== 3) return false;
        const [tRoomId, tClientId, signature] = parts;
        if (tRoomId !== roomId) return false;
        const expectedSig = crypto.createHmac('sha256', SECRET).update(`${tRoomId}:${tClientId}`).digest('hex');
        return signature === expectedSig;
    } catch (err) {
        return false;
    }
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

        // If the room doesn't exist, we allow it (for room creation / auto-creation logic or backward compatibility)
        if (!room) {
            return next();
        }

        // If the room is not protected, does not have a stack key, and is not accept_only, access is public.
        const hasNoSecurity = !room.is_protected && !room.stack_key && !room.accept_only;
        if (hasNoSecurity) {
            return next();
        }

        // Host verification: if the client passes their host_id matching the room's creator_socket_id, let them in.
        const hostId = req.headers['x-host-id'] || req.body.host_id || req.query.host_id;
        if (hostId && room.creator_socket_id === hostId) {
            return next();
        }

        // Token verification: check for standard room access token
        const token = req.headers['x-room-access-token'] || req.body.room_access_token;
        if (token && verifyRoomToken(token, roomId)) {
            return next();
        }

        // Client is unauthorized. Return room metadata to let the frontend present the correct join interface.
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

