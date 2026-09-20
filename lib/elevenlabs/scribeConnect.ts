// Mint a Scribe token and open the realtime socket with a short retry.
// One Speak tap must not leave a second concurrent session hanging.

import type { MessageKey } from "@/lib/i18n";

export type ScribeFailKind = "quota" | "busy" | "auth" | "error" | "cancelled";

type ScribeController = {
  connect: (token: string | null) => Promise<void>;
  disconnect: () => void | Promise<void>;
};

export type MintScribeToken = () => Promise<
  { ok: true; token: string } | { ok: false; kind: ScribeFailKind; status: number }
>;

const CONNECT_ATTEMPTS = 3;
const BACKOFF_MS = [0, 700, 1800];
const COOLDOWN_MS = 600;

let lastReleasedAt = 0;
let scribeLock: Promise<void> = Promise.resolve();

export function markScribeReleased(): void {
  lastReleasedAt = Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitScribeCooldown(ms = COOLDOWN_MS): Promise<void> {
  const waitFor = ms - (Date.now() - lastReleasedAt);
  if (waitFor > 0) await sleep(waitFor);
}

export function runExclusiveScribe<T>(fn: () => Promise<T>): Promise<T> {
  const run = scribeLock.then(fn, fn);
  scribeLock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function classifyScribeFailure(input: {
  status?: number;
  message?: string;
}): ScribeFailKind {
  const status = input.status ?? 0;
  const message = (input.message ?? "").toLowerCase();

  if (status === 401 || status === 403 || message.includes("auth_error")) {
    return "auth";
  }
  if (
    status === 402 ||
    message.includes("quota_exceeded") ||
    message.includes("quota exceeded")
  ) {
    return "quota";
  }
  if (
    status === 429 ||
    message.includes("rate_limited") ||
    message.includes("resource_exhausted") ||
    message.includes("too many") ||
    message.includes("session_started timeout") ||
    message.includes("websocket error") ||
    message.includes("scribe closed")
  ) {
    return "busy";
  }
  if (status >= 500) return "busy";
  return "error";
}

export function scribeFailKey(
  surface: "start" | "call",
  kind: ScribeFailKind
): MessageKey {
  if (kind === "quota") {
    return surface === "start"
      ? "start.brief_captions_quota"
      : "call.captions_quota";
  }
  if (kind === "busy") {
    return surface === "start"
      ? "start.brief_captions_busy"
      : "call.captions_busy";
  }
  return surface === "start"
    ? "start.brief_captions_error"
    : "call.captions_failed";
}

export const mintScribeToken: MintScribeToken = async () => {
  let res: Response;
  try {
    res = await fetch("/api/scribe-token", { method: "POST" });
  } catch {
    return { ok: false, kind: "busy", status: 0 };
  }

  if (res.ok) {
    const data = (await res.json()) as { token?: string };
    if (data.token) return { ok: true, token: data.token };
    return { ok: false, kind: "error", status: 502 };
  }

  let payload: { kind?: ScribeFailKind; error?: string } = {};
  try {
    payload = (await res.json()) as { kind?: ScribeFailKind; error?: string };
  } catch {
    payload = {};
  }

  const kind =
    payload.kind === "quota" ||
    payload.kind === "busy" ||
    payload.kind === "auth"
      ? payload.kind
      : classifyScribeFailure({
          status: res.status,
          message: payload.error,
        });
  return { ok: false, kind, status: res.status };
};

export async function connectScribeSession(
  controller: ScribeController,
  options: {
    mint?: MintScribeToken;
    wait?: (ms: number) => Promise<void>;
    isCurrent?: () => boolean;
    attempts?: number;
  } = {}
): Promise<{ ok: true } | { ok: false; kind: ScribeFailKind }> {
  const mint = options.mint ?? mintScribeToken;
  const wait = options.wait ?? sleep;
  const isCurrent = options.isCurrent ?? (() => true);
  const attempts = options.attempts ?? CONNECT_ATTEMPTS;
  let lastKind: ScribeFailKind = "error";

  for (let i = 0; i < attempts; i += 1) {
    if (!isCurrent()) return { ok: false, kind: "cancelled" };
    if (i > 0) await wait(BACKOFF_MS[i] ?? 1800);
    if (!isCurrent()) return { ok: false, kind: "cancelled" };

    const minted = await mint();
    if (!isCurrent()) return { ok: false, kind: "cancelled" };
    if (!minted.ok) {
      lastKind = minted.kind;
      if (minted.kind === "quota" || minted.kind === "auth") {
        return { ok: false, kind: minted.kind };
      }
      continue;
    }

    try {
      await controller.connect(minted.token);
      if (!isCurrent()) {
        await Promise.resolve(controller.disconnect());
        markScribeReleased();
        return { ok: false, kind: "cancelled" };
      }
      return { ok: true };
    } catch (error) {
      await Promise.resolve(controller.disconnect());
      markScribeReleased();
      lastKind = classifyScribeFailure({
        message: error instanceof Error ? error.message : String(error),
      });
      if (lastKind === "quota" || lastKind === "auth") {
        return { ok: false, kind: lastKind };
      }
    }
  }

  return { ok: false, kind: lastKind };
}
