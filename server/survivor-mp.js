'use strict';

/**
 * Cherry Game Room — Survivor multiplayer namespace.
 *
 * Plain Socket.io broadcast relay. The namespace owns no game logic; it
 * routes:
 *   guest:* events → host
 *   host:*  events → guests in the same room
 *
 * Rooms are stored in-memory (process-scoped). When the host disconnects we
 * close the room so guests don't try to render a dangling state.
 *
 * Wire-up: `require('./survivor-mp')(io)` from server.js, called once at
 * boot. Idempotent — calling twice creates two namespaces, so don't.
 */

const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;
const MAX_PLAYERS_PER_ROOM = 4;
const NICKNAME_MAX = 16;

module.exports = function attachSurvivorMp(io) {
    const ns = io.of('/survivor');
    /** @type {Map<string, {id:string, hostSid:string, members:Map<string,{nickname:string}>}>} */
    const rooms = new Map();

    function generateRoomId() {
        for (let attempt = 0; attempt < 50; attempt++) {
            let id = '';
            for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
                id += ROOM_CODE_CHARSET[Math.floor(Math.random() * ROOM_CODE_CHARSET.length)];
            }
            if (!rooms.has(id)) return id;
        }
        return 'R' + Date.now().toString(36).toUpperCase().slice(-5);
    }

    function sanitizeNickname(raw) {
        const s = String(raw || '')
            .replace(/[<>"'`]/g, '')
            .slice(0, NICKNAME_MAX)
            .trim();
        return s || 'Player';
    }

    function roomSnapshot(room) {
        return {
            roomId: room.id,
            hostSid: room.hostSid,
            members: Array.from(room.members.entries()).map(([sid, info]) => ({
                sid,
                nickname: info.nickname,
                isHost: sid === room.hostSid
            }))
        };
    }

    function broadcastRoomState(room) {
        ns.to(room.id).emit('room:state', roomSnapshot(room));
    }

    ns.on('connection', (socket) => {
        let currentRoomId = null;

        const cleanup = () => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            const leavingId = currentRoomId;
            currentRoomId = null;
            if (!room) return;
            room.members.delete(socket.id);
            socket.leave(leavingId);
            // Host leaving collapses the room — guests have no authority to
            // continue simulating, so we close cleanly.
            if (room.hostSid === socket.id || room.members.size === 0) {
                ns.to(leavingId).emit('room:closed', { reason: 'host-left' });
                rooms.delete(leavingId);
            } else {
                broadcastRoomState(room);
            }
        };

        socket.on('room:create', (payload, ack) => {
            const nickname = sanitizeNickname(payload?.nickname);
            const id = generateRoomId();
            const room = {
                id,
                hostSid: socket.id,
                members: new Map([[socket.id, { nickname }]])
            };
            rooms.set(id, room);
            currentRoomId = id;
            socket.join(id);
            try {
                ack?.({ ok: true, roomId: id, hostSid: socket.id, sid: socket.id, nickname });
            } catch (_e) {
                /* swallow ack errors — client may have disconnected */
            }
            broadcastRoomState(room);
        });

        socket.on('room:join', (payload, ack) => {
            const id = String(payload?.roomId || '')
                .toUpperCase()
                .trim();
            const nickname = sanitizeNickname(payload?.nickname);
            const room = rooms.get(id);
            if (!room) return ack?.({ ok: false, error: 'NOT_FOUND' });
            if (room.members.size >= MAX_PLAYERS_PER_ROOM) {
                return ack?.({ ok: false, error: 'FULL' });
            }
            room.members.set(socket.id, { nickname });
            currentRoomId = id;
            socket.join(id);
            try {
                ack?.({
                    ok: true,
                    roomId: id,
                    hostSid: room.hostSid,
                    sid: socket.id,
                    nickname
                });
            } catch (_e) {
                /* swallow */
            }
            broadcastRoomState(room);
        });

        socket.on('room:leave', () => cleanup());

        // Host → guests in the room: world tick + arbitrary events.
        socket.on('host:tick', (state) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room || room.hostSid !== socket.id) return;
            socket.to(currentRoomId).emit('host:tick', state);
        });
        socket.on('host:event', (evt) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room || room.hostSid !== socket.id) return;
            socket.to(currentRoomId).emit('host:event', evt);
        });

        // Guest → host: input vector + arbitrary events.
        socket.on('guest:input', (input) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;
            ns.to(room.hostSid).emit('guest:input', { sid: socket.id, ...input });
        });
        socket.on('guest:event', (evt) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;
            ns.to(room.hostSid).emit('guest:event', { sid: socket.id, ...evt });
        });

        socket.on('disconnect', () => cleanup());
    });

    // eslint-disable-next-line no-console
    console.log('🧛 [survivor-mp] /survivor namespace attached');
};
