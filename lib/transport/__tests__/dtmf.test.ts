import { dtmfFrequencies } from "../dtmf";

describe("dtmfFrequencies", () => {
  test("maps the twelve keypad keys", () => {
    expect(dtmfFrequencies("1")).toEqual([697, 1209]);
    expect(dtmfFrequencies("5")).toEqual([770, 1336]);
    expect(dtmfFrequencies("9")).toEqual([852, 1477]);
    expect(dtmfFrequencies("0")).toEqual([941, 1336]);
    expect(dtmfFrequencies("*")).toEqual([941, 1209]);
    expect(dtmfFrequencies("#")).toEqual([941, 1477]);
  });

  test("rejects unknown keys", () => {
    expect(dtmfFrequencies("A")).toBeNull();
    expect(dtmfFrequencies("")).toBeNull();
  });
});
