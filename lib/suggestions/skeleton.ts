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
  callLanguage: CallLanguage,
  playbookId = "power-cut"
): ReplySuggestion[] {
  const give = (hi: string, en: string) =>
    callLanguage === "hi" ? hi : en;

  if (playbookId === "bank") {
    const bank = facts.bank_name?.trim() ?? "";
    const account = facts.account_or_card?.trim() ?? "";
    return [
      {
        id: "s-bank",
        label: t("call.suggest.bank_name"),
        sentence: bank
          ? give(`मेरा बैंक ${bank} है।`, `My bank is ${bank}.`)
          : missingFactSentence(callLanguage),
      },
      {
        id: "s-account",
        label: t("call.suggest.account"),
        sentence: account
          ? give(`मेरा खाता या कार्ड क्रमांक ${account} है।`, `My account or card number is ${account}.`)
          : missingFactSentence(callLanguage),
      },
      {
        id: "s-ask-number",
        label: t("call.suggest.ask_complaint"),
        sentence: give(
          "कृपया शिकायत या संदर्भ संख्या बताइए।",
          "Please give the complaint or reference number."
        ),
      },
    ];
  }

  if (playbookId === "hospital") {
    const hospital = facts.hospital_name?.trim() ?? "";
    const patient = facts.patient_name?.trim() ?? "";
    return [
      {
        id: "s-hospital",
        label: t("call.suggest.hospital_name"),
        sentence: hospital
          ? give(`यह ${hospital} के लिए है।`, `This is for ${hospital}.`)
          : missingFactSentence(callLanguage),
      },
      {
        id: "s-patient",
        label: t("call.suggest.patient_name"),
        sentence: patient
          ? give(`मरीज का नाम ${patient} है।`, `The patient's name is ${patient}.`)
          : missingFactSentence(callLanguage),
      },
      {
        id: "s-ask-number",
        label: t("call.suggest.ask_complaint"),
        sentence: give(
          "कृपया पंजीकरण या संदर्भ संख्या बताइए।",
          "Please give the registration or reference number."
        ),
      },
    ];
  }

  const consumer = facts.consumer_number?.trim() ?? "";
  const area = facts.area?.trim() ?? "";
  const since = facts.since_when?.trim() ?? "";

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
