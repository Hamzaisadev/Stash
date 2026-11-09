import { describe, it, expect, beforeAll, vi } from 'vitest';

// auth.js reads TOKEN_SECRET at import time and exits if it is missing, and it
// imports supabase.js (which also exits without credentials). Both are set here
// before the dynamic import below.
process.env.TOKEN_SECRET = 'a'.repeat(64);
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-service-key';

vi.mock('../supabase.js', () => ({ supabase: {} }));

let generateRoomToken, verifyRoomToken, generateHostToken, verifyHostToken, isVerifiedHost;

beforeAll(async () => {
    const mod = await import('./auth.js');
    ({ generateRoomToken, verifyRoomToken, generateHostToken, verifyHostToken, isVerifiedHost } = mod);
});

describe('room access tokens', () => {
    it('accepts a token it just issued for the same room', () => {
        const token = generateRoomToken('room-a', 'client-1');
        expect(verifyRoomToken(token, 'room-a')).toBe(true);
    });

    it('rejects a token issued for a different room', () => {
        const token = generateRoomToken('room-a', 'client-1');
        expect(verifyRoomToken(token, 'room-b')).toBe(false);
    });

    it('rejects a tampered signature', () => {
        const token = generateRoomToken('room-a', 'client-1');
        const parts = token.split(':');
        parts[3] = 'f'.repeat(parts[3].length);
        expect(verifyRoomToken(parts.join(':'), 'room-a')).toBe(false);
    });

    it('rejects a token whose payload was edited to extend its life', () => {
        const token = generateRoomToken('room-a', 'client-1');
        const [roomId, clientId, , sig] = token.split(':');
        const future = Date.now() + 1_000_000;
        expect(verifyRoomToken(`${roomId}:${clientId}:${future}:${sig}`, 'room-a')).toBe(false);
    });

    it('rejects tokens older than 24 hours', () => {
        const token = generateRoomToken('room-a', 'client-1');
        const stale = Date.now() + 25 * 60 * 60 * 1000;
        vi.spyOn(Date, 'now').mockReturnValue(stale);
        try {
            expect(verifyRoomToken(token, 'room-a')).toBe(false);
        } finally {
            Date.now.mockRestore();
        }
    });

    it('rejects malformed and empty input', () => {
        for (const bad of ['', null, undefined, 'not-a-token', 'a:b:c', 'a:b:c:d:e', {}, 42]) {
            expect(verifyRoomToken(bad, 'room-a')).toBe(false);
        }
    });
});

describe('host tokens', () => {
    it('accepts a host token for its own room', () => {
        const token = generateHostToken('room-a');
        expect(verifyHostToken(token, 'room-a')).toBe(true);
    });

    it('rejects a host token for a different room', () => {
        const token = generateHostToken('room-a');
        expect(verifyHostToken(token, 'room-b')).toBe(false);
    });

    it('rejects a forged host token', () => {
        expect(verifyHostToken('host:room-a:123:deadbeef', 'room-a')).toBe(false);
    });

    it('does not accept a room access token as a host token', () => {
        const roomToken = generateRoomToken('room-a', 'client-1');
        expect(verifyHostToken(roomToken, 'room-a')).toBe(false);
    });

    it('does not accept a host token as a room access token', () => {
        const hostToken = generateHostToken('room-a');
        expect(verifyRoomToken(hostToken, 'room-a')).toBe(false);
    });
});

describe('isVerifiedHost', () => {
    it('accepts a valid host token from the header', () => {
        const token = generateHostToken('room-a');
        expect(isVerifiedHost({ headers: { 'x-host-token': token } }, 'room-a')).toBe(true);
    });

    it('accepts a valid host token from body or query', () => {
        const token = generateHostToken('room-a');
        expect(isVerifiedHost({ headers: {}, body: { host_token: token } }, 'room-a')).toBe(true);
        expect(isVerifiedHost({ headers: {}, query: { host_token: token } }, 'room-a')).toBe(true);
    });

    // This is the regression that mattered: host rights used to be granted by a
    // client-invented x-host-id string, so anyone who learned a room's creator
    // id could take the room over.
    it('does NOT grant host rights for a bare client id', () => {
        expect(isVerifiedHost({ headers: { 'x-host-id': 'client_abc123' } }, 'room-a')).toBe(false);
    });

    it('does not grant host rights with no credentials at all', () => {
        expect(isVerifiedHost({ headers: {} }, 'room-a')).toBe(false);
    });
});
