import { isBackupError } from "../autoswitch";

describe("isBackupError", () => {
  test("treats quota and credit errors as backup", () => {
    expect(isBackupError(new Error("quota_exceeded"))).toBe(true);
    expect(isBackupError("insufficient credits")).toBe(true);
    expect(isBackupError("429 Too Many Requests")).toBe(true);
  });

  test("treats a killed ElevenLabs key as backup", () => {
    expect(isBackupError(new Error("auth_error"))).toBe(true);
    expect(isBackupError("401 unauthorized")).toBe(true);
  });

  test("does not switch on a normal caption", () => {
    expect(isBackupError("hello power cut")).toBe(false);
  });
});
