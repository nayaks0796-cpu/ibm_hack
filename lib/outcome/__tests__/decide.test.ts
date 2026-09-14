import { decideCallOutcome } from "../decide";
import { detectRefusal } from "../refuse";
import type { TranscriptEntry } from "../../types";

function clerk(text: string): TranscriptEntry {
  return {
    t: 1,
    side: "clerk",
    source: "stt",
    text,
    redacted: false,
  };
}

describe("detectRefusal", () => {
  test("catches a clear English refusal", () => {
    expect(detectRefusal("Sorry, we cannot register this complaint.")).toBe(true);
  });

  test("catches a Hindi refusal", () => {
    expect(detectRefusal("हम यह शिकायत दर्ज नहीं कर सकते।")).toBe(true);
  });

  test("does not treat an OTP warning as a refusal", () => {
    expect(detectRefusal("Do not share OTP.")).toBe(false);
  });

  test("does not treat a normal clerk line as a refusal", () => {
    expect(detectRefusal("Please give me your consumer number.")).toBe(false);
  });
});

describe("decideCallOutcome", () => {
  test("pinned number is resolved", () => {
    expect(
      decideCallOutcome({
        pinnedReferenceNumber: "COMP-4821",
        transcript: [clerk("Your complaint number is COMP-4821.")],
        refused: false,
      })
    ).toEqual({ result: "resolved", referenceNumber: "COMP-4821" });
  });

  test("never invents a complaint number", () => {
    expect(
      decideCallOutcome({
        pinnedReferenceNumber: null,
        transcript: [clerk("Please hold.")],
        refused: false,
      })
    ).toEqual({ result: "incomplete", referenceNumber: null });
  });

  test("no clerk speech is no-answer", () => {
    expect(
      decideCallOutcome({
        pinnedReferenceNumber: null,
        transcript: [],
        refused: false,
      })
    ).toEqual({ result: "no-answer", referenceNumber: null });
  });

  test("refusal wins even if a number was pinned", () => {
    expect(
      decideCallOutcome({
        pinnedReferenceNumber: "COMP-4821",
        transcript: [clerk("We cannot help.")],
        refused: true,
      })
    ).toEqual({ result: "refused", referenceNumber: "COMP-4821" });
  });
});
