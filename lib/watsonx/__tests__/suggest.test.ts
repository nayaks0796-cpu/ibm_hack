import { formatTypicalFlow, parseSuggestionJson, sanitizeSuggestions, formatClerkComplaintNumbers, attachClerkReferenceFacts, pickBetterGloss } from "../llama";
import { formatPlaybookStages, getPlaybook } from "../../playbooks";
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

  test("reads a suggestions object from Groq json_object mode", () => {
    const raw =
      '{"suggestions":[{"id":"s1","label":"Give area","sentence":"I am in Andheri."}]}';
    expect(parseSuggestionJson(raw)).toEqual([
      { id: "s1", label: "Give area", sentence: "I am in Andheri." },
    ]);
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

  test("drops an invented complaint number even if digits look familiar", () => {
    const facts = { consumer_number: "4821" };
    const raw = [
      {
        id: "s1",
        label: "Give complaint",
        sentence: "Your complaint number is COMP-4821.",
      },
      {
        id: "s2",
        label: "Ask for number",
        sentence: "Please give the complaint number.",
      },
    ];
    expect(sanitizeSuggestions(raw, facts, history).map((item) => item.id)).toEqual(
      ["s2"]
    );
  });

  test("allows reading back a complaint number the clerk already said", () => {
    const withClerk: TranscriptEntry[] = [
      {
        t: 1,
        side: "clerk",
        source: "stt",
        text: "Your complaint number is COMP-4821.",
        redacted: false,
      },
    ];
    const raw = [
      {
        id: "s1",
        label: "Confirm number",
        sentence: "Thank you. I noted complaint number COMP-4821.",
      },
    ];
    expect(sanitizeSuggestions(raw, {}, withClerk)).toHaveLength(1);
  });

  test("allows a complaint number that is only in the latest caption", () => {
    const raw = [
      {
        id: "s1",
        label: "Confirm number",
        sentence: "Thank you. I noted complaint number COMP-4821.",
      },
    ];
    expect(
      sanitizeSuggestions(raw, {}, [], "Your complaint number is COMP-4821.")
    ).toHaveLength(1);
  });

  test("does not treat our-side speech as a clerk complaint number", () => {
    const ours: TranscriptEntry[] = [
      {
        t: 1,
        side: "us",
        source: "tts-sent",
        text: "Your complaint number is COMP-9999.",
        redacted: false,
      },
    ];
    const raw = [
      {
        id: "s1",
        label: "Confirm number",
        sentence: "Thank you. I noted complaint number COMP-9999.",
      },
      {
        id: "s2",
        label: "Ask for number",
        sentence: "Please give the complaint number.",
      },
    ];
    expect(sanitizeSuggestions(raw, {}, ours).map((item) => item.id)).toEqual([
      "s2",
    ]);
  });
});

describe("formatClerkComplaintNumbers", () => {
  test("says none yet when the clerk has not given a number", () => {
    expect(formatClerkComplaintNumbers([])).toMatch(/none yet/i);
  });

  test("lists a number the clerk actually said", () => {
    const history: TranscriptEntry[] = [
      {
        t: 1,
        side: "clerk",
        source: "stt",
        text: "Your complaint number is COMP-4821.",
        redacted: false,
      },
    ];
    expect(formatClerkComplaintNumbers(history)).toMatch(/COMP-4821/);
  });

  test("ignores a number we spoke ourselves", () => {
    const history: TranscriptEntry[] = [
      {
        t: 1,
        side: "us",
        source: "tts-sent",
        text: "Your complaint number is COMP-9999.",
        redacted: false,
      },
    ];
    expect(formatClerkComplaintNumbers(history)).toMatch(/none yet/i);
  });
});

describe("attachClerkReferenceFacts", () => {
  test("takes the complaint number from clerk text, not from the LLM", () => {
    expect(
      attachClerkReferenceFacts(
        { reference_number: "FAKE-0001", area: "Andheri" },
        "Your complaint number is COMP-4821."
      )
    ).toEqual({ reference_number: "COMP-4821", area: "Andheri" });
  });

  test("never extracts a complaint number from our side", () => {
    expect(
      attachClerkReferenceFacts(
        { reference_number: "COMP-4821" },
        "Your complaint number is COMP-4821.",
        false
      )
    ).toEqual({});
  });
});

describe("typical call stages", () => {
  test("power-cut has a short stage map, not a transcript", () => {
    const playbook = getPlaybook("power-cut");
    expect(playbook?.stages?.length).toBeGreaterThanOrEqual(4);
    const text = formatPlaybookStages(playbook?.stages, "en");
    expect(text).toMatch(/complaint or reference number/i);
    expect(text).not.toMatch(/COMP-4821/);
  });

  test("prompt helper tells the model not to copy stages as facts", () => {
    const block = formatTypicalFlow("power-cut", "en");
    expect(block).toMatch(/NOT facts/i);
    expect(block).toMatch(/NOT a transcript/i);
  });
});

describe("pickBetterGloss", () => {
  test("keeps local signs when the LLM only fingerspells", () => {
    expect(
      pickBetterGloss(["P", "O", "W", "E", "R"], ["POWER", "CUT", "MORNING"])
    ).toEqual(["POWER", "CUT", "MORNING"]);
  });

  test("keeps the LLM gloss when it has more real signs", () => {
    expect(
      pickBetterGloss(["POWER", "CUT", "AREA"], ["POWER", "CUT"])
    ).toEqual(["POWER", "CUT", "AREA"]);
  });

  test("keeps the local phrase map when both have the same number of signs", () => {
    expect(
      pickBetterGloss(["ELECTRICITY", "PROBLEM", "MORNING"], ["POWER", "CUT", "MORNING"])
    ).toEqual(["POWER", "CUT", "MORNING"]);
  });
});
