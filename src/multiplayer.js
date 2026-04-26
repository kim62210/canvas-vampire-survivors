/**
 * @module multiplayer
 * @description Thin Socket.io client wrapper for the host-authoritative
 * Survivor multiplayer mode. The server (cherry-game-server's `/survivor`
 * namespace) only relays messages — all game logic stays in the host's
 * `Game` instance. Guests are thin clients: they emit `guest:input` /
 * `guest:event` and render whatever `host:tick` payloads arrive.
 *
 * The Socket.io client itself is loaded from a CDN script tag in
 * `index.html`, so this module just expects `window.io` to exist.
 *
 * Exports:
 *   - class MultiplayerClient
 *
 * Public API:
 *   const mp = new MultiplayerClient();
 *   mp.connect();                          // open socket
 *   await mp.createRoom(nickname);         // → { roomId, hostSid, sid }
 *   await mp.joinRoom(roomId, nickname);   // → { ok, hostSid, sid, error? }
 *   mp.leaveRoom();
 *   mp.onRoomState(cb);                    // members list updates
 *   mp.onRoomClosed(cb);
 *   mp.onHostTick(cb);                     // guests subscribe
 *   mp.onHostEvent(cb);
 *   mp.onGuestInput(cb);                   // host subscribes
 *   mp.onGuestEvent(cb);
 *   mp.sendHostTick(state);                // host → all guests
 *   mp.sendHostEvent(evt);
 *   mp.sendGuestInput(input);              // guest → host
 *   mp.sendGuestEvent(evt);
 *   mp.disconnect();
 *   mp.isHost / mp.isGuest                 // role helpers
 */

const SURVIVOR_NS = '/survivor';

export class MultiplayerClient {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.sid = null;
        this.hostSid = null;
        this.nickname = null;
        this._listeners = {
            roomState: [],
            roomClosed: [],
            hostTick: [],
            hostEvent: [],
            guestInput: [],
            guestEvent: [],
            roomsList: []
        };
    }

    get connected() {
        return !!(this.socket && this.socket.connected);
    }
    get isHost() {
        return !!(this.sid && this.hostSid && this.sid === this.hostSid);
    }
    get isGuest() {
        return !!(this.sid && this.hostSid && this.sid !== this.hostSid);
    }

    connect() {
        if (this.socket) return;
        if (typeof window === 'undefined' || !window.io) {
            throw new Error('Socket.io client not loaded (window.io missing)');
        }
        // The cherry-game-server is reverse-proxied at the same origin as
        // /survivor/, so a path-relative connect works for both prod and dev.
        this.socket = window.io(SURVIVOR_NS, {
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });
        this.socket.on('room:state', (snap) => {
            if (snap?.roomId) this.roomId = snap.roomId;
            if (snap?.hostSid) this.hostSid = snap.hostSid;
            this._fire('roomState', snap);
        });
        this.socket.on('room:closed', (info) => {
            this.roomId = null;
            this.hostSid = null;
            this._fire('roomClosed', info);
        });
        this.socket.on('host:tick', (state) => this._fire('hostTick', state));
        this.socket.on('host:event', (evt) => this._fire('hostEvent', evt));
        this.socket.on('guest:input', (input) => this._fire('guestInput', input));
        this.socket.on('guest:event', (evt) => this._fire('guestEvent', evt));
        // iter-27: lobby room list — pushed on connect and on every mutation.
        this.socket.on('rooms:list', (payload) => this._fire('roomsList', payload?.rooms || []));
    }

    disconnect() {
        if (!this.socket) return;
        try {
            this.socket.disconnect();
        } catch (_e) {
            /* noop */
        }
        this.socket = null;
        this.roomId = null;
        this.sid = null;
        this.hostSid = null;
    }

    /** Resolves to `{ ok: true, roomId, hostSid, sid }` on success. */
    createRoom(nickname) {
        this._ensureConnected();
        this.nickname = nickname || 'Player';
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('create-room timeout')), 5000);
            this.socket.emit('room:create', { nickname: this.nickname }, (resp) => {
                clearTimeout(timeout);
                if (!resp?.ok) return reject(new Error(resp?.error || 'create-room failed'));
                this.roomId = resp.roomId;
                this.hostSid = resp.hostSid;
                this.sid = resp.sid;
                resolve(resp);
            });
        });
    }

    /** Resolves to `{ ok: true, hostSid, sid }` or `{ ok: false, error }`. */
    joinRoom(roomId, nickname) {
        this._ensureConnected();
        this.nickname = nickname || 'Player';
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve({ ok: false, error: 'TIMEOUT' }), 5000);
            this.socket.emit('room:join', { roomId, nickname: this.nickname }, (resp) => {
                clearTimeout(timeout);
                if (resp?.ok) {
                    this.roomId = resp.roomId;
                    this.hostSid = resp.hostSid;
                    this.sid = resp.sid;
                }
                resolve(resp || { ok: false, error: 'NO_RESP' });
            });
        });
    }

    leaveRoom() {
        if (!this.socket) return;
        try {
            this.socket.emit('room:leave');
        } catch (_e) {
            /* noop */
        }
        this.roomId = null;
        this.hostSid = null;
    }

    sendHostTick(state) {
        if (this.socket && this.isHost) this.socket.emit('host:tick', state);
    }
    sendHostEvent(evt) {
        if (this.socket && this.isHost) this.socket.emit('host:event', evt);
    }
    sendGuestInput(input) {
        if (this.socket && this.isGuest) this.socket.emit('guest:input', input);
    }
    sendGuestEvent(evt) {
        if (this.socket && this.isGuest) this.socket.emit('guest:event', evt);
    }

    /** Resolves to `{ ok: true, rooms: [{roomId, host, count, max, full}] }`. */
    listRooms() {
        this._ensureConnected();
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve({ ok: false, rooms: [] }), 3000);
            this.socket.emit('rooms:list', {}, (resp) => {
                clearTimeout(timeout);
                resolve(resp || { ok: false, rooms: [] });
            });
        });
    }

    onRoomState(cb) {
        this._listeners.roomState.push(cb);
    }
    onRoomClosed(cb) {
        this._listeners.roomClosed.push(cb);
    }
    onRoomsList(cb) {
        this._listeners.roomsList.push(cb);
    }
    onHostTick(cb) {
        this._listeners.hostTick.push(cb);
    }
    onHostEvent(cb) {
        this._listeners.hostEvent.push(cb);
    }
    onGuestInput(cb) {
        this._listeners.guestInput.push(cb);
    }
    onGuestEvent(cb) {
        this._listeners.guestEvent.push(cb);
    }

    _fire(name, payload) {
        for (const cb of this._listeners[name] || []) {
            try {
                cb(payload);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn(`[mp] listener ${name} threw`, e);
            }
        }
    }

    _ensureConnected() {
        if (!this.socket) this.connect();
    }
}
