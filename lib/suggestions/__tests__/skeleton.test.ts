import { applyUiLanguage } from "../../i18n";
import {
  contextualSuggestions,
  detectClerkIntent,
  finalizeReplySuggestions,
  isOffTask,
  keepCaptionRelevant,
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
      "Tanish M."
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
    const items = contextualSuggestions(facts, "en", "power-cut", "", "Tanish");
    expect(items.map((item) => item.id)).toEqual([
      "disclosure",
      "s-consumer",
      "s-area",
    ]);
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
});

describe("finalizeReplySuggestions", () => {
  test("injects return-to-purpose even if the LLM forgets it", () => {
    const items = finalizeReplySuggestions({
      facts,
      callLanguage: "en",
      playbookId: "power-cut",
      caption: "The cricket score was amazing last night",
      name: "Tanish",
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

  test("does not inject return-to-purpose when the clerk asks for a fact", () => {
    const items = finalizeReplySuggestions({
      facts,
      callLanguage: "en",
      playbookId: "power-cut",
      caption: "What is your consumer number?",
      name: "Tanish",
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
