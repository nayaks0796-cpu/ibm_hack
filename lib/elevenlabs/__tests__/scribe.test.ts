import { createScribeSTT } from "../scribe";

describe("createScribeSTT", () => {
  test("refuses to connect without a Scribe token", async () => {
    const stt = createScribeSTT("en", () => undefined);
    await expect(stt.connect(null)).rejects.toThrow("Scribe token missing");
  });
});
