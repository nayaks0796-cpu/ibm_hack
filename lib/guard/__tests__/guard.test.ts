import { containsSensitiveCode } from "../otp";
import {
  clerkSpokenReferenceNumbers,
  detectReferenceNumbers,
  isClerkSpokenReference,
} from "../refnum";
import { redact } from "../redact";

// ── OTP / PIN blocker ──────────────────────────────────────────────────────────

describe("containsSensitiveCode", () => {
  test("blocks 'OTP is 482911'", () => {
    expect(containsSensitiveCode("OTP is 482911")).toBe(true);
  });

  test("blocks Hindi ओटीपी with digits", () => {
    expect(containsSensitiveCode("आपका ओटीपी 123456 है")).toBe(true);
  });

  test("blocks PIN followed by digits", () => {
    expect(containsSensitiveCode("your PIN 4821")).toBe(true);
  });

  test("blocks CVV in a sentence", () => {
    expect(containsSensitiveCode("CVV is 321")).toBe(true);
  });

  test("blocks 'password 9988776655'", () => {
    expect(containsSensitiveCode("password 9988776655")).toBe(true);
  });

  test("does NOT block a normal sentence", () => {
    expect(containsSensitiveCode("Please give me your consumer number.")).toBe(false);
  });

  test("does NOT block when keyword present but no 3+ digit sequence", () => {
    expect(containsSensitiveCode("What is your PIN?")).toBe(false);
  });

  test("does NOT block PIN letters inside another word", () => {
    expect(containsSensitiveCode("Keep spinning 123456")).toBe(false);
  });

  test("blocks Aadhaar followed by 12 digits", () => {
    expect(containsSensitiveCode("Aadhaar 1234 5678 9012")).toBe(true);
    expect(containsSensitiveCode("आधार 123456789012")).toBe(true);
  });

  test("does NOT treat a consumer number as Aadhaar", () => {
    expect(containsSensitiveCode("My consumer number is 123456789012")).toBe(
      false
    );
  });
});

// ── Reference-number detector ──────────────────────────────────────────────────

describe("detectReferenceNumbers", () => {
  test("detects COMP-4821 (definition-of-done case)", () => {
    const result = detectReferenceNumbers("complaint number COMP-4821");
    expect(result).toContain("COMP-4821");
  });

  test("detects alphanumeric pattern like TICK123456", () => {
    const result = detectReferenceNumbers("Your ticket number is TICK123456");
    expect(result).toContain("TICK123456");
  });

  test("detects standalone 8-digit number after 'reference'", () => {
    const result = detectReferenceNumbers("reference 12345678");
    expect(result.some((r) => r.includes("12345678"))).toBe(true);
  });

  test("detects शिकायत with digit number", () => {
    const result = detectReferenceNumbers("आपकी शिकायत संख्या 9876543 है");
    expect(result.some((r) => r.includes("9876543"))).toBe(true);
  });

  test("returns empty array when no reference number present", () => {
    expect(detectReferenceNumbers("Please hold on.")).toEqual([]);
  });

  test("detects lowercase comp-4821", () => {
    const result = detectReferenceNumbers("complaint number comp-4821");
    expect(result).toContain("COMP-4821");
  });

  test("does not treat an OTP as a complaint number", () => {
    expect(detectReferenceNumbers("OTP is 482911")).toEqual([]);
  });

  test("returns empty array for 5-digit number without keyword", () => {
    expect(detectReferenceNumbers("call 98765")).toEqual([]);
  });
});

describe("clerkSpokenReferenceNumbers", () => {
  test("only counts clerk captions, never our side", () => {
    const refs = clerkSpokenReferenceNumbers([
      {
        t: 1,
        side: "us",
        source: "tts-sent",
        text: "complaint number COMP-9999",
        redacted: false,
      },
      {
        t: 2,
        side: "clerk",
        source: "stt",
        text: "Your complaint number is COMP-4821.",
        redacted: false,
      },
    ]);
    expect(refs).toEqual(["COMP-4821"]);
  });

  test("isClerkSpokenReference is false for invented pins", () => {
    expect(
      isClerkSpokenReference("COMP-4821", [
        {
          t: 1,
          side: "clerk",
          source: "stt",
          text: "Please hold.",
          redacted: false,
        },
      ])
    ).toBe(false);
  });
});

// ── Redaction ─────────────────────────────────────────────────────────────────

describe("redact", () => {
  test("redacts digits after OTP keyword", () => {
    const result = redact("OTP is 482911");
    expect(result).not.toContain("482911");
    expect(result).toContain("••••");
  });

  test("redacts digits after password keyword", () => {
    const result = redact("password 9988776655");
    expect(result).not.toContain("9988776655");
    expect(result).toContain("••••");
  });

  test("does not modify text without sensitive keywords", () => {
    const text = "Please give me your consumer number 1234567890.";
    expect(redact(text)).toBe(text);
  });

  test("redacts Hindi OTP digits", () => {
    const result = redact("आपका ओटीपी 123456 है");
    expect(result).not.toContain("123456");
    expect(result).toContain("••••");
  });
});
