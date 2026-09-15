// In-process message + presence hub for clerk ↔ user sync.
// Used by POST/GET /api/room-relay so `npm run dev` works without the WS custom server.

export type HubEnvelope = {
  id: number;
  fromRole: string;
  data: unknown;
};

export type HubPull = {
  cursor: number;
  peers: { user: boolean; clerk: boolean };
  messages: unknown[];
};

type Waiter = () => void;

type HubRoom = {
  seq: number;
  messages: HubEnvelope[];
  presence: Record<string, number>;
  waiters: Set<Waiter>;
};

const PRESENCE_TTL_MS = 8000;
const MAX_MESSAGES = 80;

type GlobalHub = { __samparkRoomHub?: Map<string, HubRoom> };

function rooms(): Map<string, HubRoom> {
  const g = globalThis as GlobalHub;
  if (!g.__samparkRoomHub) g.__samparkRoomHub = new Map();
  return g.__samparkRoomHub;
}

function getRoom(roomId: string): HubRoom {
  const all = rooms();
  let room = all.get(roomId);
  if (!room) {
    room = { seq: 0, messages: [], presence: {}, waiters: new Set() };
    all.set(roomId, room);
  }
  return room;
}

function isFresh(ts: number | undefined, now: number): boolean {
  return typeof ts === "number" && now - ts < PRESENCE_TTL_MS;
}

export function snapshotPeers(roomId: string): { user: boolean; clerk: boolean } {
  const room = getRoom(roomId);
  const now = Date.now();
  return {
    user: isFresh(room.presence.user, now),
    clerk: isFresh(room.presence.clerk, now),
  };
}

export function touchPresence(roomId: string, role: string): void {
  const room = getRoom(roomId);
  room.presence[role] = Date.now();
}

export function dropPresence(roomId: string, role: string): void {
  const room = getRoom(roomId);
  delete room.presence[role];
  wake(room);
}

export function publish(
  roomId: string,
  fromRole: string,
  data: unknown
): HubEnvelope {
  const room = getRoom(roomId);
  touchPresence(roomId, fromRole);
  room.seq += 1;
  const envelope: HubEnvelope = { id: room.seq, fromRole, data };
  room.messages.push(envelope);
  if (room.messages.length > MAX_MESSAGES) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES);
  }
  wake(room);
  return envelope;
}

function wake(room: HubRoom): void {
  const waiters = [...room.waiters];
  room.waiters.clear();
  for (const waiter of waiters) waiter();
}

function waitForPublish(
  room: HubRoom,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      room.waiters.delete(finish);
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    room.waiters.add(finish);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

/** after < 0: presence snapshot only (no backlog replay). */
export async function pull(
  roomId: string,
  role: string,
  after: number,
  signal?: AbortSignal
): Promise<HubPull> {
  const room = getRoom(roomId);
  touchPresence(roomId, role);

  if (after >= 0) {
    const pending = room.messages.filter(
      (item) => item.id > after && item.fromRole !== role
    );
    if (pending.length === 0) {
      await waitForPublish(room, 9000, signal);
    }
  }

  const fresh = getRoom(roomId);
  const messages =
    after >= 0
      ? fresh.messages
          .filter((item) => item.id > after && item.fromRole !== role)
          .map((item) => item.data)
      : [];

  return {
    cursor: fresh.seq,
    peers: snapshotPeers(roomId),
    messages,
  };
}
