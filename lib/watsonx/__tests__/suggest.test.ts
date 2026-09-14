import { parseSuggestionJson, sanitizeSuggestions } from "../llama";
import type { TranscriptEntry } from "../../types";

describe("parseSuggestionJson", () => {
  test("reads a JSON array from model output", () => {
    const raw =
      'Here you go\n[{"id":"s1","label":"Give area","sentence":"I am in Andheri."}]\n';
    expect(parseSuggestionJson(raw)).toEqual([
      { id: "s1", label: "Give area", sentence: "I am in Andheri." },
    ]);
  });

  test("returns empty when there is no array", () => {
    expect(parseSuggestionJson("sorry")).toEqual([]);
  });
});

describe("sanitizeSuggestions", () => {
  const history: TranscriptEntry[] = [];

  test("drops invented numbers that are not in facts", () => {
    const facts = { area: "Andheri" };
    const raw = [
      {
        id: "s1",
        label: "Give number",
        sentence: "मेरा उपभोक्ता क्रमांक 9999999999 है।",
      },
      {
        id: "s2",
        label: "Give area",
        sentence: "मेरा क्षेत्र Andheri है।",
      },
    ];
    expect(sanitizeSuggestions(raw, facts, history).map((item) => item.id)).toEqual(
      ["s2"]
    );
  });

  test("keeps a consumer number that the user saved", () => {
    const facts = { consumer_number: "1234567890" };
    const raw = [
      {
        id: "s1",
        label: "Give number",
        sentence: "मेरा उपभोक्ता क्रमांक 1234567890 है।",
      },
    ];
    expect(sanitizeSuggestions(raw, facts, history)).toHaveLength(1);
  });

  test("drops OTP sentences", () => {
    const raw = [
      { id: "s1", label: "Say OTP", sentence: "OTP is 482911" },
    ];
    expect(sanitizeSuggestions(raw, {}, history)).toEqual([]);
  });
});
