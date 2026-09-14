// lib/transport/CallRoom.ts
// Real-time synchronization layer between the User (/call) and Clerk (/clerk) interfaces.
// Combines WebSocket relay (/api/room-relay) with BroadcastChannel cross-tab synchronization.

export type CallRoomMessage =
  | { type: "clerk-caption"; text: string; isFinal?: boolean; timestamp?: number }
  | { type: "user-tts"; text: string; audioBase64?: string; timestamp?: number }
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
  | { type: "room-joined"; roomId: string; role: string; clientCount?: number };

export type MessageHandler = (msg: CallRoomMessage) => void;

export class CallRoom {
  private ws: WebSocket | null = null;
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  readonly roomId: string;
  readonly role: "user" | "clerk";

  constructor(roomId: string = "demo-room", role: "user" | "clerk" = "user") {
    this.roomId = roomId;
    this.role = role;
    this.initBroadcastChannel();
    this.connectWs();
    this.initStorageFallback();
  }

  private initBroadcastChannel(): void {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    try {
      this.channel = new BroadcastChannel(`sampark_room_${this.roomId}`);
      this.channel.onmessage = (event: MessageEvent) => {
        const msg = event.data as CallRoomMessage;
        if (msg && typeof msg.type === "string") {
          this.emit(msg);
        }
      };
    } catch {
      // Fallback to storage events if BroadcastChannel is blocked
    }
  }

  private initStorageFallback(): void {
    if (typeof window === "undefined") return;
    const storageKey = `sampark_event_${this.roomId}`;
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const envelope = JSON.parse(e.newValue);
          if (envelope.sender !== this.role && envelope.data) {
            this.emit(envelope.data);
          }
        } catch {}
      }
    });
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

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data) as CallRoomMessage;
          this.emit(msg);
        } catch {}
      };

      this.ws.onclose = () => {
        if (!this.disposed) {
          this.reconnectTimer = setTimeout(() => this.connectWs(), 2000);
        }
      };

      this.ws.onerror = () => {
        // ws errors are safely ignored; BroadcastChannel handles local communication
      };
    } catch {
      // Offline / purely local fallback
    }
  }

  private emit(msg: CallRoomMessage): void {
    this.handlers.forEach((h) => {
      try {
        h(msg);
      } catch (err) {
        console.error("[CallRoom] handler error:", err);
      }
    });
  }

  send(msg: CallRoomMessage): void {
    // 1. Send via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {}
    }

    // 2. Send via BroadcastChannel for instant local cross-tab sync
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }

    // 3. Update localStorage fallback
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `sampark_event_${this.roomId}`,
          JSON.stringify({ sender: this.role, time: Date.now(), data: msg })
        );
      } catch {}
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
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
    this.handlers.clear();
  }
}
