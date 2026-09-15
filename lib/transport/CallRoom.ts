// lib/transport/CallRoom.ts
// Real-time sync between User (/call) and Clerk (/clerk).
// Transports: WebSocket relay, HTTP long-poll (works with `npm run dev`),
// BroadcastChannel, and localStorage. Presence is an explicit hello/ack/heartbeat.

export type CallRoomRole = "user" | "clerk";

export type CallRoomMessage = (
  | { type: "clerk-caption"; text: string; isFinal?: boolean; timestamp?: number }
  | {
      type: "user-tts";
      text: string;
      lang?: "hi" | "en";
      audioBase64?: string;
      timestamp?: number;
    }
  | { type: "user-caption"; text: string; timestamp?: number }
  | { type: "dtmf"; digit: string; timestamp?: number }
  | { type: "line-state"; state: "active" | "silent" | "disconnected" }
  | {
      type: "session-sync";
      playbookId: string;
      callerName: string;
      callLanguage: string;
      facts: Record<string, string>;
    }
  | { type: "call-ended"; timestamp?: number }
  | { type: "peer-joined"; role: string; clientCount?: number }
  | { type: "peer-left"; role: string; clientCount?: number }
  | {
      type: "room-joined";
      roomId: string;
      role: string;
      clientCount?: number;
      peerRoles?: string[];
    }
  | { type: "hello"; role: CallRoomRole; timestamp?: number }
  | { type: "hello-ack"; role: CallRoomRole; timestamp?: number }
  | { type: "presence"; role: CallRoomRole; timestamp?: number }
  | { type: "bye"; role: CallRoomRole; timestamp?: number }
) & { msgId?: string };

export type MessageHandler = (msg: CallRoomMessage) => void;
export type PeerHandler = (connected: boolean) => void;

const GLOBAL_SEEN_MSG_IDS = new Set<string>();
const HEARTBEAT_MS = 2000;
const PEER_TIMEOUT_MS = 6000;

function otherRole(role: CallRoomRole): CallRoomRole {
  return role === "user" ? "clerk" : "user";
}

function isPresencePacket(
  msg: CallRoomMessage
): msg is CallRoomMessage & { type: "hello" | "hello-ack" | "presence" | "bye"; role: CallRoomRole } {
  return (
    msg.type === "hello" ||
    msg.type === "hello-ack" ||
    msg.type === "presence" ||
    msg.type === "bye"
  );
}

export class CallRoom {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<MessageHandler>();
  private peerHandlers = new Set<PeerHandler>();
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollAbort: AbortController | null = null;
  private hubCursor = -1;
  private wsRelayReady = false;
  private wsJoinTimer: ReturnType<typeof setTimeout> | null = null;
  private peerLastSeen = 0;
  private peerConnected = false;
  private started = false;
  private disposed = false;
  readonly roomId: string;
  readonly role: CallRoomRole;
  readonly peerRole: CallRoomRole;

  constructor(roomId: string = "demo-room", role: CallRoomRole = "user") {
    this.roomId = roomId;
    this.role = role;
    this.peerRole = otherRole(role);
    this.initBroadcastChannel();
    this.initStorageFallback();
    this.connectWs();
    queueMicrotask(() => this.startPresence());
  }

  get isPeerConnected(): boolean {
    return this.peerConnected;
  }

  onPeerChange(handler: PeerHandler): () => void {
    this.peerHandlers.add(handler);
    handler(this.peerConnected);
    return () => this.peerHandlers.delete(handler);
  }

  private presenceStorageKey(): string {
    return `sampark_presence_${this.roomId}`;
  }

  private eventStorageKey(): string {
    return `sampark_event_${this.roomId}`;
  }

  private startPresence(): void {
    if (this.disposed || this.started) return;
    this.started = true;
    this.readStoredPresence();
    this.announce();
    if (typeof window === "undefined") return;
    this.heartbeatTimer = setInterval(() => {
      if (this.disposed) return;
      this.sendPresence();
      this.expirePeerIfStale();
    }, HEARTBEAT_MS);
    if (this.httpHubEnabled()) {
      void this.pollLoop();
    }
  }

  private readStoredPresence(): void {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(this.presenceStorageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      const ts = parsed[this.peerRole];
      if (typeof ts === "number" && Date.now() - ts < PEER_TIMEOUT_MS) {
        this.notePeerSeen();
      }
    } catch {}
  }

  private writeStoredPresence(): void {
    if (typeof window === "undefined") return;
    try {
      const key = this.presenceStorageKey();
      const parsed = (() => {
        try {
          return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, number>;
        } catch {
          return {} as Record<string, number>;
        }
      })();
      parsed[this.role] = Date.now();
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch {}
  }

  private announce(): void {
    this.writeStoredPresence();
    this.send({ type: "hello", role: this.role, timestamp: Date.now() });
  }

  private sendPresence(): void {
    this.writeStoredPresence();
    this.send({ type: "presence", role: this.role, timestamp: Date.now() });
  }

  private notePeerSeen(): void {
    this.peerLastSeen = Date.now();
    if (this.peerConnected) return;
    this.peerConnected = true;
    this.peerHandlers.forEach((handler) => {
      try {
        handler(true);
      } catch (err) {
        console.error("[CallRoom] peer handler error:", err);
      }
    });
  }

  private notePeerLost(): void {
    if (!this.peerConnected) return;
    this.peerConnected = false;
    this.peerLastSeen = 0;
    this.peerHandlers.forEach((handler) => {
      try {
        handler(false);
      } catch (err) {
        console.error("[CallRoom] peer handler error:", err);
      }
    });
  }

  private expirePeerIfStale(): void {
    if (!this.peerConnected || !this.peerLastSeen) return;
    if (Date.now() - this.peerLastSeen > PEER_TIMEOUT_MS) {
      this.notePeerLost();
    }
  }

  private initBroadcastChannel(): void {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    try {
      this.channel = new BroadcastChannel(`sampark_room_${this.roomId}`);
      this.channel.onmessage = (event: MessageEvent) => {
        const msg = event.data as CallRoomMessage;
        if (msg && typeof msg.type === "string") {
          this.ingest(msg);
        }
      };
    } catch {
      // Fallback to storage events if BroadcastChannel is blocked
    }
  }

  private initStorageFallback(): void {
    if (typeof window === "undefined") return;
    const eventKey = this.eventStorageKey();
    const presenceKey = this.presenceStorageKey();
    this.storageHandler = (e: StorageEvent) => {
      if (e.key === eventKey && e.newValue) {
        try {
          const envelope = JSON.parse(e.newValue) as {
            sender?: string;
            data?: CallRoomMessage;
          };
          if (envelope.sender !== this.role && envelope.data) {
            this.ingest(envelope.data);
          }
        } catch {}
      }
      if (e.key === presenceKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Record<string, number>;
          const ts = parsed[this.peerRole];
          if (typeof ts === "number" && Date.now() - ts < PEER_TIMEOUT_MS) {
            this.notePeerSeen();
          }
        } catch {}
      }
    };
    window.addEventListener("storage", this.storageHandler);
  }

  private connectWs(): void {
    if (typeof window === "undefined" || this.disposed) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const url = `${protocol}//${host}/api/room-relay?room=${encodeURIComponent(
        this.roomId
      )}&role=${encodeURIComponent(this.role)}`;

      this.ws = new WebSocket(url);
      this.wsRelayReady = false;

      this.ws.onopen = () => {
        // Only trust this socket after the custom relay sends room-joined.
        this.wsJoinTimer = setTimeout(() => {
          if (!this.wsRelayReady && this.ws) {
            try {
              this.ws.close();
            } catch {}
          }
        }, 1500);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data) as CallRoomMessage;
          this.ingest(msg);
        } catch {}
      };

      this.ws.onclose = () => {
        const wasReady = this.wsRelayReady;
        this.ws = null;
        this.wsRelayReady = false;
        if (this.wsJoinTimer) {
          clearTimeout(this.wsJoinTimer);
          this.wsJoinTimer = null;
        }
        if (!this.disposed) {
          this.reconnectTimer = setTimeout(
            () => this.connectWs(),
            wasReady ? 2000 : 8000
          );
        }
      };

      this.ws.onerror = () => {
        // HTTP long-poll + BroadcastChannel cover the case where WS is unavailable.
      };
    } catch {
      // Offline / purely local fallback
    }
  }

  private async pollLoop(): Promise<void> {
    if (typeof window === "undefined") return;
    this.pollAbort = new AbortController();

    while (!this.disposed) {
      try {
        const after = this.hubCursor;
        const res = await fetch(
          `/api/room-relay?room=${encodeURIComponent(this.roomId)}&role=${encodeURIComponent(
            this.role
          )}&after=${after}`,
          { signal: this.pollAbort.signal, cache: "no-store" }
        );
        if (!res.ok) {
          await sleep(1500, this.pollAbort.signal);
          continue;
        }
        const data = (await res.json()) as {
          cursor?: number;
          peers?: { user?: boolean; clerk?: boolean };
          messages?: CallRoomMessage[];
        };
        if (typeof data.cursor === "number") this.hubCursor = data.cursor;
        if (data.peers?.[this.peerRole]) this.notePeerSeen();
        for (const msg of data.messages ?? []) {
          if (msg && typeof msg.type === "string") this.ingest(msg);
        }
      } catch {
        if (this.disposed) return;
        await sleep(1500, this.pollAbort.signal);
      }
    }
  }

  private ingest(msg: CallRoomMessage): void {
    if (msg.msgId) {
      if (GLOBAL_SEEN_MSG_IDS.has(msg.msgId)) return;
      GLOBAL_SEEN_MSG_IDS.add(msg.msgId);
      if (GLOBAL_SEEN_MSG_IDS.size > 500) {
        const first = GLOBAL_SEEN_MSG_IDS.values().next().value;
        if (first) GLOBAL_SEEN_MSG_IDS.delete(first);
      }
    }

    if (msg.type === "room-joined") {
      this.wsRelayReady = true;
      if (this.wsJoinTimer) {
        clearTimeout(this.wsJoinTimer);
        this.wsJoinTimer = null;
      }
      this.announce();
      this.forward(msg);
      return;
    }

    if (msg.type === "peer-joined") {
      if (msg.role === this.peerRole) {
        this.notePeerSeen();
        this.announce();
      }
      this.forward(msg);
      return;
    }

    if (msg.type === "peer-left") {
      if (msg.role === this.peerRole) {
        this.notePeerLost();
      }
      this.forward(msg);
      return;
    }

    if (isPresencePacket(msg)) {
      if (msg.role !== this.peerRole) return;
      if (msg.type === "bye") {
        this.notePeerLost();
        return;
      }
      this.notePeerSeen();
      if (msg.type === "hello") {
        this.send({ type: "hello-ack", role: this.role, timestamp: Date.now() });
      }
      return;
    }

    this.notePeerSeen();
    this.forward(msg);
  }

  /** Deliver to page listeners. Dedup happens in ingest. */
  private forward(msg: CallRoomMessage): void {
    this.handlers.forEach((h) => {
      try {
        h(msg);
      } catch (err) {
        console.error("[CallRoom] handler error:", err);
      }
    });
  }

  /** @internal tests inject inbound packets through ingest. */
  emit(msg: CallRoomMessage): void {
    this.ingest(msg);
  }

  send(msg: CallRoomMessage): void {
    if (!msg.msgId) {
      msg.msgId = `${this.role}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    GLOBAL_SEEN_MSG_IDS.add(msg.msgId);

    if (this.wsRelayReady && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {}
    }

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          this.eventStorageKey(),
          JSON.stringify({ sender: this.role, time: Date.now(), data: msg })
        );
      } catch {}
      this.postHub(msg);
    }
  }

  /** HTTP long-poll/post. Off in `next dev` — the flood locks Windows `.next` and 404s CSS. */
  private httpHubEnabled(): boolean {
    return process.env.NODE_ENV === "production";
  }

  private postHub(msg: CallRoomMessage): void {
    if (!this.httpHubEnabled()) return;
    try {
      void fetch("/api/room-relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: this.roomId,
          role: this.role,
          data: msg,
          bye: msg.type === "bye",
        }),
        keepalive: true,
      });
    } catch {}
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    if (!this.disposed) {
      try {
        this.send({ type: "bye", role: this.role, timestamp: Date.now() });
      } catch {}
    }
    this.disposed = true;
    if (this.pollAbort) {
      try {
        this.pollAbort.abort();
      } catch {}
      this.pollAbort = null;
    }
    if (this.wsJoinTimer) {
      clearTimeout(this.wsJoinTimer);
      this.wsJoinTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    if (typeof window !== "undefined" && this.storageHandler) {
      try {
        window.removeEventListener("storage", this.storageHandler);
      } catch {}
      this.storageHandler = null;
    }
    this.handlers.clear();
    this.peerHandlers.clear();
    if (typeof window !== "undefined") {
      try {
        const key = this.presenceStorageKey();
        const parsed = JSON.parse(localStorage.getItem(key) || "{}") as Record<
          string,
          number
        >;
        delete parsed[this.role];
        localStorage.setItem(key, JSON.stringify(parsed));
      } catch {}
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
