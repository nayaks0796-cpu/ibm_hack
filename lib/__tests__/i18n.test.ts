import { applyUiLanguage, t, UI_LANGUAGE_IDS } from "../i18n";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import ta from "../../messages/ta.json";
import te from "../../messages/te.json";
import kn from "../../messages/kn.json";
import ml from "../../messages/ml.json";
import mr from "../../messages/mr.json";
import bn from "../../messages/bn.json";

const DICTS = { en, hi, ta, te, kn, ml, mr, bn } as const;

describe("UI languages", () => {
  test("every locale has the same keys as English", () => {
    const expected = Object.keys(en).sort();
    for (const id of UI_LANGUAGE_IDS) {
      expect(Object.keys(DICTS[id]).sort()).toEqual(expected);
    }
  });

  test("Hindi, Tamil and Bengali are not leftover Setu strings", () => {
    expect(t("app.title", undefined, "hi")).toBe("संपर्क");
    expect(t("app.title", undefined, "ta")).toBe("சம்பார்க்");
    expect(t("app.title", undefined, "bn")).toBe("সম্পর্ক");
    expect(t("call.send", undefined, "ta")).toBe("அனுப்பு");
    expect(t("outcome.new_call", undefined, "mr")).toBe("नवीन कॉल");
  });

  test("applyUiLanguage changes the default t() locale", () => {
    applyUiLanguage("kn");
    expect(t("call.end")).toBe("ಕರೆ ಮುಗಿಸಿ");
    applyUiLanguage("en");
    expect(t("call.end")).toBe("End call");
  });

  test("interpolates greeting names", () => {
    expect(t("start.greeting", { name: "Tanish M" }, "hi")).toBe("नमस्ते, Tanish M");
  });
});
