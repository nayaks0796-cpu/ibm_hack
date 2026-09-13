import { t } from "../i18n";
import { missingFactSentence } from "../format";
import type { CallLanguage, ReplySuggestion } from "../types";

export function disclosureSuggestion(
  name: string,
  _callLanguage: CallLanguage
): ReplySuggestion {
  const spokenName = name.trim();
  return {
    id: "disclosure",
    label: t("call.suggest.introduce"),
    sentence: spokenName
      ? `${spokenName}. I am speaking through an assistive relay.`
      : "I am speaking through an assistive relay.",
  };
}

export function contextualSuggestions(
  facts: Record<string, string>,
  callLanguage: CallLanguage
): ReplySuggestion[] {
  const consumer = facts.consumer_number?.trim() ?? "";
  const area = facts.area?.trim() ?? "";
  const since = facts.since_when?.trim() ?? "";

  const give = (hi: string, en: string) =>
    callLanguage === "hi" ? hi : en;

  const items: ReplySuggestion[] = [
    {
      id: "s-consumer",
      label: t("call.suggest.consumer_number"),
      sentence: consumer
        ? give(
            `मेरा उपभोक्ता क्रमांक ${consumer} है।`,
            `My consumer number is ${consumer}.`
          )
        : missingFactSentence(callLanguage),
    },
    {
      id: "s-area",
      label: t("call.suggest.area"),
      sentence: area
        ? give(`मेरा क्षेत्र ${area} है।`, `I am in ${area}.`)
        : missingFactSentence(callLanguage),
    },
  ];

  if (since) {
    items.push({
      id: "s-since",
      label: t("call.suggest.since_when"),
      sentence: give(`बिजली ${since} से गुल है।`, `The power has been out since ${since}.`),
    });
  }

  items.push({
    id: "s-ask-number",
    label: t("call.suggest.ask_complaint"),
    sentence: give(
      "कृपया शिकायत संख्या बताइए।",
      "Please give the complaint number."
    ),
  });

  return items;
}

export function alwaysPresentSuggestions(
  callLanguage: CallLanguage
): ReplySuggestion[] {
  const give = (hi: string, en: string) =>
    callLanguage === "hi" ? hi : en;

  return [
    {
      id: "always-wait",
      label: t("call.wait"),
      sentence: give("कृपया एक मिनट रुकिए।", "Please wait a moment."),
    },
    {
      id: "always-repeat",
      label: t("call.please_repeat"),
      sentence: give("कृपया दोबारा बोलिए।", "Please repeat that."),
    },
    {
      id: "always-understand",
      label: t("call.did_not_understand"),
      sentence: give("मुझे समझ नहीं आया।", "I did not understand."),
    },
    {
      id: "always-complaint",
      label: t("call.give_complaint_number"),
      sentence: give(
        "कृपया शिकायत संख्या बताइए।",
        "Please give the complaint number."
      ),
    },
  ];
}
