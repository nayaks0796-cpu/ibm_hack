import { isEchoOfRecentTts, normalizeHeard, ttsHoldMs } from "../echoGate";

describe("ttsHoldMs", () => {
  test("covers a short line and a long one without running forever", () => {
    expect(ttsHoldMs("Hi")).toBe(900);
    expect(ttsHoldMs("A".repeat(400))).toBe(12_000);
    expect(ttsHoldMs("Hello, my name is Tanish.")).toBeGreaterThan(900);
  });
});

describe("isEchoOfRecentTts", () => {
  test("matches the same sentence with punctuation noise", () => {
    expect(
      isEchoOfRecentTts(
        "Hello, my name is Tanish. I am speaking through an assistive relay.",
        "Hello my name is Tanish I am speaking through an assistive relay"
      )
    ).toBe(true);
  });

  test("does not treat a real clerk reply as echo", () => {
    expect(
      isEchoOfRecentTts(
        "Please provide your consumer number.",
        "Hello, there is a power cut in Andheri."
      )
    ).toBe(false);
  });

  test("normalizeHeard collapses case and extra marks", () => {
    expect(normalizeHeard("  COMP-4821! ")).toBe("comp 4821");
  });
});
