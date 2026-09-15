import { applyUiLanguage } from "../../i18n";
import {
  contextualSuggestions,
  detectClerkIntent,
  finalizeReplySuggestions,
  isOffTask,
  keepCaptionRelevant,
  parseIvrMenuSuggestions,
} from "../skeleton";

beforeAll(() => {
  applyUiLanguage("en");
});

const facts = {
  consumer_number: "1234567890",
  area: "Andheri",
};

describe("detectClerkIntent", () => {
  test("treats 'what are you doing' as confusion about the relay", () => {
    expect(detectClerkIntent("What are you doing?")).toBe("confused");
    expect(detectClerkIntent("क्या कर रहे हो")).toBe("confused");
    expect(detectClerkIntent("Is this a robot?")).toBe("confused");
  });

  test("detects a request for the consumer number", () => {
    expect(detectClerkIntent("What is your consumer number?")).toBe("ask-id");
  });

  test("detects hold / transfer as call progress", () => {
    expect(detectClerkIntent("Please hold the line")).toBe("hold");
  });

  test("detects an IVR menu", () => {
    expect(detectClerkIntent("Press 1 for English, press 2 for Hindi")).toBe(
      "ivr-menu"
    );
  });

  test("treats a clerk-issued complaint number as gave-reference", () => {
    expect(
      detectClerkIntent("Your complaint has been registered. Number is COMP-4821.")
    ).toBe("gave-reference");
    expect(
      detectClerkIntent("आपकी शिकायत संख्या COMP-4821 है।")
    ).toBe("gave-reference");
  });

  test("does not treat asking for a complaint number as giving one", () => {
    expect(detectClerkIntent("Please give me your consumer number.")).toBe(
      "ask-id"
    );
  });
});

describe("isOffTask", () => {
  test("marks chit-chat and relay confusion as off the call purpose", () => {
    expect(isOffTask("What are you doing?", "power-cut")).toBe(true);
    expect(isOffTask("Did you watch the match yesterday?", "power-cut")).toBe(
      true
    );
    expect(isOffTask("How is the weather in Mumbai?", "power-cut")).toBe(true);
  });

  test("keeps official call progress on-task", () => {
    expect(isOffTask("What is your consumer number?", "power-cut")).toBe(false);
    expect(isOffTask("Please hold", "power-cut")).toBe(false);
    expect(isOffTask("Hello", "power-cut")).toBe(false);
    expect(isOffTask("I will register this complaint now", "power-cut")).toBe(
      false
    );
  });
});

describe("contextualSuggestions", () => {
  test("offers a return-to-purpose reply when the clerk is confused", () => {
    const items = contextualSuggestions(
      facts,
      "en",
      "power-cut",
      "What are you doing?",
      "Tanish M"
    );
    expect(items.map((item) => item.id)).toEqual([
      "s-return-purpose",
      "s-explain-relay",
      "s-why-calling",
    ]);
    expect(items[0].sentence).toMatch(/power-cut complaint/i);
  });

  test("steers back when the clerk chats about something unrelated", () => {
    const items = contextualSuggestions(
      facts,
      "en",
      "power-cut",
      "Did you watch the match yesterday?"
    );
    expect(items[0].id).toBe("s-return-purpose");
    expect(items.map((item) => item.id)).not.toContain("s-consumer");
  });

  test("gives the consumer number when the clerk asks for it", () => {
    const items = contextualSuggestions(
      facts,
      "en",
      "power-cut",
      "Please give your consumer number"
    );
    expect(items.map((item) => item.id)).toEqual(["s-consumer"]);
    expect(items[0].sentence).toContain("1234567890");
    expect(items.map((item) => item.id)).not.toContain("s-return-purpose");
  });

  test("opening state still offers introduce plus playbook facts", () => {
    const items = contextualSuggestions(facts, "en", "power-cut", "", "Tanish M");
    expect(items.map((item) => item.id)).toEqual([
      "disclosure",
      "s-consumer",
      "s-area",
    ]);
  });

  test("offers to confirm a complaint number the clerk just gave", () => {
    const items = contextualSuggestions(
      facts,
      "en",
      "power-cut",
      "Your complaint number is COMP-4821."
    );
    expect(items[0].id).toBe("s-confirm-complaint");
    expect(items[0].sentence).toContain("COMP-4821");
    expect(items[0].sentence).not.toMatch(/COMP-9999/);
  });
});

describe("keepCaptionRelevant", () => {
  test("drops fact-dumps unless the clerk asked for those facts", () => {
    const dump = {
      id: "s1",
      label: "Give my consumer number",
      sentence: "My consumer number is 1234567890.",
    };
    const relay = {
      id: "s2",
      label: "Explain the relay",
      sentence: "This is an assistive relay speaking for me.",
    };
    expect(
      keepCaptionRelevant("Did you watch the match?", [dump, relay]).map(
        (item) => item.id
      )
    ).toEqual(["s2"]);
    expect(
      keepCaptionRelevant("What is your consumer number?", [dump]).map(
        (item) => item.id
      )
    ).toEqual(["s1"]);
  });

  test("keeps an LLM confirmation of a clerk-given complaint number", () => {
    const confirm = {
      id: "s1",
      label: "Confirm the complaint number",
      sentence: "Thank you. I have noted complaint number COMP-4821.",
    };
    expect(
      keepCaptionRelevant("Your complaint number is COMP-4821.", [confirm]).map(
        (item) => item.id
      )
    ).toEqual(["s1"]);
  });

  test("drops an invented complaint number when the clerk never said one", () => {
    const invented = {
      id: "s1",
      label: "Confirm the complaint number",
      sentence: "Thank you. I have noted complaint number COMP-4821.",
    };
    expect(
      keepCaptionRelevant("Please hold on.", [invented]).map((item) => item.id)
    ).toEqual([]);
  });
});

describe("finalizeReplySuggestions", () => {
  test("injects return-to-purpose even if the LLM forgets it", () => {
    const items = finalizeReplySuggestions({
      facts,
      callLanguage: "en",
      playbookId: "power-cut",
      caption: "The cricket score was amazing last night",
      name: "Tanish M",
      llm: [
        {
          id: "s1",
          label: "I cannot talk about that",
          sentence: "I cannot talk about cricket. I am on an official call.",
        },
      ],
    });
    expect(items[0].id).toBe("s-return-purpose");
    expect(items.some((item) => item.id === "s1")).toBe(true);
  });

  test("does not pad live LLM replies with playbook fact dumps", () => {
    const items = finalizeReplySuggestions({
      facts,
      callLanguage: "en",
      playbookId: "power-cut",
      caption: "Can you hear me? Is this a recording?",
      name: "Tanish M",
      llm: [
        {
          id: "s1",
          label: "Yes I hear you",
          sentence: "Yes, I can hear you.",
        },
        {
          id: "s2",
          label: "Explain the relay",
          sentence: "I am speaking through an assistive relay.",
        },
        {
          id: "s3",
          label: "Get back to the issue",
          sentence: "Please help with the power-cut complaint.",
        },
      ],
    });
    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["s1", "s2"])
    );
    expect(items.map((item) => item.id)).not.toContain("s-consumer");
    expect(items.map((item) => item.id)).not.toContain("s-area");
  });

  test("does not inject return-to-purpose when the clerk asks for a fact", () => {
    const items = finalizeReplySuggestions({
      facts,
      callLanguage: "en",
      playbookId: "power-cut",
      caption: "What is your consumer number?",
      name: "Tanish M",
      llm: [
        {
          id: "s1",
          label: "Give my consumer number",
          sentence: "My consumer number is 1234567890.",
        },
      ],
    });
    expect(items.map((item) => item.id)).not.toContain("s-return-purpose");
    expect(items[0].sentence).toContain("1234567890");
  });
});

describe("parseIvrMenuSuggestions", () => {
  test("turns press-N lines into DTMF suggestions", () => {
    const items = parseIvrMenuSuggestions(
      "Press 1 for English. Press 2 for Hindi. Press 0 for operator."
    );
    expect(items[0].action).toBe("dtmf");
    expect(items.map((item) => item.digit)).toEqual(
      expect.arrayContaining(["1", "2", "0"])
    );
  });
});
