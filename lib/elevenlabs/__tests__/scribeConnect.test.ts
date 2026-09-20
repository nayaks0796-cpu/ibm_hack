import {
  classifyScribeFailure,
  connectScribeSession,
  scribeFailKey,
} from "../scribeConnect";

describe("classifyScribeFailure", () => {
  test("treats 429 and rate_limited as busy", () => {
    expect(classifyScribeFailure({ status: 429 })).toBe("busy");
    expect(classifyScribeFailure({ message: "rate_limited" })).toBe("busy");
    expect(classifyScribeFailure({ message: "Scribe session_started timeout" })).toBe(
      "busy"
    );
    expect(classifyScribeFailure({ message: "Scribe WebSocket error" })).toBe("busy");
    expect(classifyScribeFailure({ message: "Scribe closed: 1008" })).toBe("busy");
    expect(classifyScribeFailure({ status: 503 })).toBe("busy");
  });

  test("treats quota_exceeded as quota", () => {
    expect(classifyScribeFailure({ message: "quota_exceeded" })).toBe("quota");
    expect(classifyScribeFailure({ status: 402 })).toBe("quota");
  });

  test("treats auth errors as auth", () => {
    expect(classifyScribeFailure({ status: 401 })).toBe("auth");
    expect(classifyScribeFailure({ message: "auth_error" })).toBe("auth");
  });
});

describe("scribeFailKey", () => {
  test("maps busy and quota to distinct copy keys", () => {
    expect(scribeFailKey("start", "busy")).toBe("start.brief_captions_busy");
    expect(scribeFailKey("start", "quota")).toBe("start.brief_captions_quota");
    expect(scribeFailKey("call", "busy")).toBe("call.captions_busy");
    expect(scribeFailKey("call", "error")).toBe("call.captions_failed");
  });
});

describe("connectScribeSession", () => {
  test("retries a busy connect then succeeds", async () => {
    let attempts = 0;
    const controller = {
      connect: async () => {
        attempts += 1;
        if (attempts < 2) throw new Error("Scribe session_started timeout");
      },
      disconnect: async () => undefined,
    };
    const minted = jest.fn(async () => ({ ok: true as const, token: `tok-${attempts}` }));

    const result = await connectScribeSession(controller, {
      mint: minted,
      wait: async () => undefined,
    });

    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(2);
    expect(minted).toHaveBeenCalledTimes(2);
  });

  test("does not retry a quota failure", async () => {
    const controller = {
      connect: async () => {
        throw new Error("quota_exceeded");
      },
      disconnect: async () => undefined,
    };

    const result = await connectScribeSession(controller, {
      mint: async () => ({ ok: true, token: "tok" }),
      wait: async () => undefined,
    });

    expect(result).toEqual({ ok: false, kind: "quota" });
  });

  test("stops when the session is no longer current", async () => {
    const result = await connectScribeSession(
      {
        connect: async () => undefined,
        disconnect: async () => undefined,
      },
      {
        mint: async () => ({ ok: true, token: "tok" }),
        isCurrent: () => false,
        wait: async () => undefined,
      }
    );

    expect(result).toEqual({ ok: false, kind: "cancelled" });
  });
});
