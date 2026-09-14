import { hasSign } from "../catalog";
import { runPlaybookExam } from "../exam";
import {
  alignGlossToCatalog,
  captionToGloss,
  scoreGloss,
} from "../mapGloss";
import { PHRASES, WORD_SYNONYMS } from "../synonyms";

describe("ISL synonym table", () => {
  test("every synonym and phrase target exists in the sign catalog", () => {
    const missing: string[] = [];
    for (const [source, targets] of Object.entries(WORD_SYNONYMS)) {
      for (const lemma of targets) {
        if (!hasSign(lemma)) missing.push(`${source} → ${lemma}`);
      }
    }
    for (const [phrase, targets] of PHRASES) {
      for (const lemma of targets) {
        if (!hasSign(lemma)) missing.push(`"${phrase}" → ${lemma}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("alignGlossToCatalog", () => {
  test("maps POWER OUT onto existing signs instead of the word OUT", () => {
    expect(alignGlossToCatalog(["POWER", "OUT"])).toEqual(["POWER", "CUT"]);
  });

  test("maps Llama inventions onto catalog words", () => {
    expect(alignGlossToCatalog(["OUTAGE", "CONSUMER", "NUMBER"])).toEqual([
      "POWER",
      "CUT",
      "NUMBER",
    ]);
  });

  test("maps hospital and bank words onto the closest real signs", () => {
    expect(alignGlossToCatalog(["HOSPITAL", "EMERGENCY"])).toEqual([
      "CLINIC",
      "AMBULANCE",
    ]);
    expect(alignGlossToCatalog(["BANK", "FRAUD"])).toEqual(["MONEY", "PROBLEM"]);
  });

  test("fingerspells a name and skips a long code", () => {
    const gloss = alignGlossToCatalog(["TANIS", "COMP-4821"]);
    expect(gloss).toEqual(["T", "A", "N", "I", "S"]);
  });
});

describe("captionToGloss", () => {
  test("power has been out since morning", () => {
    const gloss = captionToGloss("Power has been out since morning.");
    expect(gloss).toEqual(expect.arrayContaining(["POWER", "CUT", "MORNING"]));
    expect(gloss).not.toContain("OUT");
  });

  test("please hold / repeat / did not understand", () => {
    expect(captionToGloss("Please hold.")).toEqual(
      expect.arrayContaining(["HOLD", "WAIT"])
    );
    expect(captionToGloss("Please repeat.")).toContain("REPEAT");
    expect(captionToGloss("I did not understand.")).toContain("DONOTUNDERSTAND");
  });

  test("Hindi power-cut caption", () => {
    expect(captionToGloss("बिजली गुल है सुबह से।")).toEqual(
      expect.arrayContaining(["POWER", "CUT", "MORNING"])
    );
  });

  test("does not fingerspell a pinned complaint number", () => {
    const gloss = captionToGloss("Your complaint number is COMP-4821.");
    expect(gloss).toEqual(expect.arrayContaining(["COMPLAINT", "NUMBER"]));
    expect(gloss.filter((token) => token.length === 1)).toEqual([]);
  });
});

describe("playbook exam", () => {
  test("most clerk-line tokens hit a real sign, not fingerspelling", () => {
    const exam = runPlaybookExam();
    const weak = exam.lines.filter((line) => line.rate < 0.5);
    expect(exam.rate).toBeGreaterThanOrEqual(0.85);
    expect(
      weak.map((line) => `${line.playbookId}: ${line.caption} → ${line.gloss.join(" ")}`)
    ).toEqual([]);
  });

  test("exam coverage helper counts letters as spelled", () => {
    expect(scoreGloss(["POWER", "T", "A"])).toEqual({
      signed: 1,
      spelled: 2,
      rate: 1 / 3,
    });
  });
});
