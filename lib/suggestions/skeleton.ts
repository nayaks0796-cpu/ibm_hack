import { t } from "../i18n";
import { missingFactSentence } from "../format";
import type { AccessNeed, CallLanguage, ReplySuggestion } from "../types";

export type ClerkIntent =
  | "confused"
  | "ask-name"
  | "ask-id"
  | "ask-place"
  | "ask-when"
  | "ask-problem"
  | "ask-details"
  | "hold"
  | "greeting"
  | "unknown";

type Give = (hi: string, en: string) => string;

function giveFor(callLanguage: CallLanguage): Give {
  return (hi, en) => (callLanguage === "hi" ? hi : en);
}

function normalizeCaption(caption: string): string {
  return caption
    .toLowerCase()
    .replace(/[?!.,;:'"।]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectClerkIntent(caption: string): ClerkIntent {
  const c = normalizeCaption(caption);
  if (!c) return "unknown";

  const has = (re: RegExp) => re.test(c);

  if (
    has(/what are you doing/) ||
    has(/what is this/) ||
    has(/who is this/) ||
    has(/who('s| is) speaking/) ||
    has(/is this (a )?(robot|bot|recording|machine|computer|automated|ivr)/) ||
    has(/are you (a )?(robot|bot|machine|computer|recording)/) ||
    has(/why (is|are) (this|you)/) ||
    has(/computer voice|automated voice|ivr/) ||
    has(/क्या कर रहे/) ||
    has(/क्या हो रहा/) ||
    has(/यह क्या है|ये क्या है/) ||
    has(/कौन (है|बोल|बात)/) ||
    has(/रोबोट|रिकॉर्डिंग|मशीन/) ||
    has(/kya kar rahe|kya ho raha/)
  ) {
    return "confused";
  }

  if (
    has(/your name|naam kya|what is your name/) ||
    has(/नाम (क्या|बताओ|बताइए|बताएँ)/) ||
    has(/who am i (speaking|talking)/)
  ) {
    return "ask-name";
  }

  if (
    has(/consumer|meter number|account number|card number|customer (id|number)/) ||
    has(/उपभोक्ता|मीटर|खाता|कार्ड न/) ||
    has(/patient name|मरीज/)
  ) {
    return "ask-id";
  }

  if (
    has(/which area|your area|your address|where (are|do) you|location|colony/) ||
    has(/क्षेत्र|पता|कहाँ|कहां/) ||
    has(/hospital name|अस्पताल/)
  ) {
    return "ask-place";
  }

  if (has(/how long|since when|when did|कब से|कितने (समय|देर)/)) {
    return "ask-when";
  }

  if (
    has(/what('s| is) the (problem|issue)/) ||
    has(/nature of (the )?complaint|how can i help/) ||
    has(/reason for (calling|the call)/) ||
    has(/क्या समस्या|क्या बात|क्या शिकायत/)
  ) {
    return "ask-problem";
  }

  if (
    has(/your details|give me (your|the) (details|information)/) ||
    has(/tell me (your|the) details/) ||
    has(/जानकारी|विवरण/)
  ) {
    return "ask-details";
  }

  if (
    has(/please hold|hold (on|the line)/) ||
    has(/one (minute|moment|second)/) ||
    has(/transfer(ring)?|connecting|press [0-9]/) ||
    has(/रुकिए|एक मिनट|होल्ड|कनेक्ट/)
  ) {
    return "hold";
  }

  if (
    has(/^(hello|hi|hey|namaste|namaskar|yes|haan|हां|हाँ|नमस्ते|नमस्कार)( |$)/)
  ) {
    return "greeting";
  }

  return "unknown";
}

const TASK_TERMS: Record<string, RegExp> = {
  "power-cut":
    /power|electric|bijli|outage|load\s*shed|meter|consumer|colony|area|complaint|ticket|reference|बिजली|गुल|कटौती|शिकायत|उपभोक्ता|मीटर|क्षेत्र/,
  bank: /bank|card|account|fraud|transaction|cyber|1930|unauthorized|block|upi|बैंक|कार्ड|खाता|धोखा|लेनदेन|लेन देन/,
  hospital:
    /hospital|doctor|appoint|emergency|patient|bed|department|clinic|अस्पताल|डॉक्टर|अपॉइंट|मरीज|आपातकाल|विभाग/,
};

const ON_TASK_PROCESS =
  /register|complaint|ticket|reference|checking|looking|noted|note down|filing|\bfile\b|system|hold|wait|transfer|connecting|press |option |menu |taking (this|your)|write (this|it)|शिकायत|दर्ज|रजिस्टर/;

const ASKED_FOR_FACTS: ClerkIntent[] = [
  "ask-id",
  "ask-place",
  "ask-when",
  "ask-details",
];

const ON_TASK_INTENTS: ClerkIntent[] = [
  ...ASKED_FOR_FACTS,
  "ask-name",
  "ask-problem",
  "greeting",
  "hold",
];

export function isOffTask(caption: string, playbookId = "power-cut"): boolean {
  const intent = detectClerkIntent(caption);
  if (!caption.trim()) return false;
  if (ON_TASK_INTENTS.includes(intent)) return false;
  if (intent === "confused") return true;

  const c = normalizeCaption(caption);
  const task = TASK_TERMS[playbookId] ?? TASK_TERMS["power-cut"];
  if (task.test(c) || ON_TASK_PROCESS.test(c)) return false;

  const words = c.split(" ").filter(Boolean);
  if (words.length <= 2 && /^(ok|okay|hmm|accha|acha|ठीक|अच्छा)$/.test(c)) {
    return false;
  }

  return words.length >= 3 || /\?/.test(caption);
}

export function accessNeedPhrase(accessNeed: AccessNeed, callLanguage: CallLanguage): string {
  const give = giveFor(callLanguage);
  if (accessNeed === "hearing") {
    return give(
      "मैं बधिर हूँ या मुझे सुनने में दिक्कत है",
      "I am deaf or hard of hearing"
    );
  }
  if (accessNeed === "speech") {
    return give("मुझे बोलने में दिक्कत है", "I have difficulty speaking");
  }
  return give(
    "मुझे सुनने और बोलने में दिक्कत है",
    "I have difficulty hearing and speaking"
  );
}

export function disclosureSuggestion(
  name: string,
  callLanguage: CallLanguage,
  accessNeed: AccessNeed = "both"
): ReplySuggestion {
  const spokenName = name.trim();
  const give = giveFor(callLanguage);
  const need = accessNeedPhrase(accessNeed, callLanguage);

  const sentence = spokenName
    ? give(
        `नमस्ते, मेरा नाम ${spokenName} है। ${need}, इसलिए मैं सहायक रिले के माध्यम से बात कर रहा हूँ।`,
        `Hello, my name is ${spokenName}. ${need}, so I am speaking through an assistive relay.`
      )
    : give(
        `नमस्ते। ${need}, इसलिए मैं सहायक रिले के माध्यम से बात कर रहा हूँ।`,
        `Hello. ${need}, so I am speaking through an assistive relay.`
      );

  return {
    id: "disclosure",
    label: t("call.suggest.introduce"),
    sentence,
  };
}

function explainRelaySuggestion(
  callLanguage: CallLanguage,
  accessNeed: AccessNeed = "both"
): ReplySuggestion {
  const give = giveFor(callLanguage);
  const need = accessNeedPhrase(accessNeed, callLanguage);
  return {
    id: "s-explain-relay",
    label: t("call.suggest.explain_relay"),
    sentence: give(
      `${need}। यह सहायक रिले मेरी ओर से बोल रहा है। कृपया सामान्य कॉल की तरह बात कीजिए।`,
      `${need}. This is an assistive relay speaking for me. Please continue as a normal call.`
    ),
  };
}

function whyCallingSuggestion(
  callLanguage: CallLanguage,
  playbookId: string
): ReplySuggestion {
  const give = giveFor(callLanguage);
  const sentence =
    playbookId === "bank"
      ? give(
          "मैं बैंक या साइबर धोखाधड़ी की शिकायत के लिए कॉल कर रहा हूँ।",
          "I am calling about a bank or cyber fraud complaint."
        )
      : playbookId === "hospital"
        ? give(
            "मैं अस्पताल से बात करने के लिए कॉल कर रहा हूँ।",
            "I am calling about a hospital appointment or enquiry."
          )
        : give(
            "मैं बिजली कटौती की शिकायत करने और शिकायत संख्या लेने के लिए कॉल कर रहा हूँ।",
            "I am calling to report a power cut and get a complaint number."
          );
  return {
    id: "s-why-calling",
    label: t("call.suggest.why_calling"),
    sentence,
  };
}

function pleaseContinueSuggestion(callLanguage: CallLanguage): ReplySuggestion {
  const give = giveFor(callLanguage);
  return {
    id: "s-continue",
    label: t("call.suggest.please_continue"),
    sentence: give(
      "कृपया बात जारी रखिए। मैं कैप्शन से सुन पाऊँगा।",
      "Please continue. I can follow you through captions."
    ),
  };
}

function stateIssueSuggestion(
  facts: Record<string, string>,
  callLanguage: CallLanguage,
  playbookId: string
): ReplySuggestion {
  const give = giveFor(callLanguage);
  const since = facts.since_when?.trim() ?? "";
  const sentence =
    playbookId === "bank"
      ? give(
          "मुझे धोखाधड़ी की रिपोर्ट करनी है या कार्ड ब्लॉक करना है।",
          "I need to report fraud or block my card."
        )
      : playbookId === "hospital"
        ? give(
            "मुझे अपॉइंटमेंट या आपातकालीन जानकारी चाहिए।",
            "I need an appointment or an emergency enquiry."
          )
        : since
          ? give(
              `बिजली ${since} से गुल है। मुझे शिकायत दर्ज करनी है।`,
              `The power has been out since ${since}. I need to file a complaint.`
            )
          : give(
              "बिजली गुल है। मुझे शिकायत दर्ज करनी है।",
              "The power is out. I need to file a complaint."
            );
  return {
    id: "s-state-issue",
    label: t("call.suggest.state_issue"),
    sentence,
  };
}

function askWhatNeededSuggestion(callLanguage: CallLanguage): ReplySuggestion {
  const give = giveFor(callLanguage);
  return {
    id: "s-what-needed",
    label: t("call.suggest.ask_what_needed"),
    sentence: give(
      "कृपया बताइए आपको मुझसे क्या चाहिए।",
      "Please tell me what you need from me."
    ),
  };
}

export function returnToPurposeSuggestion(
  callLanguage: CallLanguage,
  playbookId: string
): ReplySuggestion {
  const give = giveFor(callLanguage);
  const sentence =
    playbookId === "bank"
      ? give(
          "कृपया धोखाधड़ी या कार्ड ब्लॉक की शिकायत पर वापस आइए। उसी में मुझे मदद चाहिए।",
          "Please go back to the fraud or card-block complaint. That is the issue I need help with."
        )
      : playbookId === "hospital"
        ? give(
            "कृपया अस्पताल अपॉइंटमेंट पर वापस आइए। उसी के लिए मैंने कॉल किया है।",
            "Please go back to the hospital appointment. That is why I called."
          )
        : give(
            "कृपया बिजली कटौती की शिकायत पर वापस आइए और शिकायत संख्या दीजिए।",
            "Please go back to the power-cut complaint and help me get a complaint number."
          );
  return {
    id: "s-return-purpose",
    label: t("call.suggest.return_to_purpose"),
    sentence,
  };
}

function looksLikeSteerBack(item: ReplySuggestion): boolean {
  return (
    item.id === "s-return-purpose" ||
    /get back to the issue|go back to (the )?(power|fraud|hospital|complaint)|वापस आइए|मुद्दे पर/i.test(
      `${item.label} ${item.sentence}`
    )
  );
}

export function ensurePurposeSteer(
  caption: string,
  playbookId: string,
  callLanguage: CallLanguage,
  suggestions: ReplySuggestion[]
): ReplySuggestion[] {
  if (!isOffTask(caption, playbookId)) return suggestions.slice(0, 5);
  const steer = returnToPurposeSuggestion(callLanguage, playbookId);
  const rest = suggestions.filter((item) => !looksLikeSteerBack(item));
  return [steer, ...rest].slice(0, 5);
}

function playbookFactSuggestions(
  facts: Record<string, string>,
  callLanguage: CallLanguage,
  playbookId: string
): ReplySuggestion[] {
  const give = giveFor(callLanguage);

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
          ? give(
              `मेरा खाता या कार्ड क्रमांक ${account} है।`,
              `My account or card number is ${account}.`
            )
          : missingFactSentence(callLanguage),
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
          ? give(
              `मरीज का नाम ${patient} है।`,
              `The patient's name is ${patient}.`
            )
          : missingFactSentence(callLanguage),
      },
      ...(facts.department?.trim()
        ? [
            {
              id: "s-department",
              label: t("call.suggest.department"),
              sentence: give(
                `यह ${facts.department.trim()} विभाग के लिए है।`,
                `This is for the ${facts.department.trim()} department.`
              ),
            },
          ]
        : []),
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
      sentence: give(
        `बिजली ${since} से गुल है।`,
        `The power has been out since ${since}.`
      ),
    });
  }

  return items;
}

function idSuggestions(
  facts: Record<string, string>,
  callLanguage: CallLanguage,
  playbookId: string
): ReplySuggestion[] {
  return playbookFactSuggestions(facts, callLanguage, playbookId).filter(
    (item) =>
      item.id === "s-consumer" ||
      item.id === "s-account" ||
      item.id === "s-patient"
  );
}

function placeSuggestions(
  facts: Record<string, string>,
  callLanguage: CallLanguage,
  playbookId: string
): ReplySuggestion[] {
  return playbookFactSuggestions(facts, callLanguage, playbookId).filter(
    (item) => item.id === "s-area" || item.id === "s-hospital"
  );
}

function whenSuggestions(
  facts: Record<string, string>,
  callLanguage: CallLanguage,
  playbookId: string
): ReplySuggestion[] {
  const fromFacts = playbookFactSuggestions(
    facts,
    callLanguage,
    playbookId
  ).filter((item) => item.id === "s-since");
  if (fromFacts.length > 0) return fromFacts;
  return [stateIssueSuggestion(facts, callLanguage, playbookId)];
}

export function contextualSuggestions(
  facts: Record<string, string>,
  callLanguage: CallLanguage,
  playbookId = "power-cut",
  caption = "",
  name = "",
  accessNeed: AccessNeed = "both"
): ReplySuggestion[] {
  const intent = caption.trim()
    ? detectClerkIntent(caption)
    : ("unknown" as ClerkIntent);

  if (!caption.trim()) {
    return [
      disclosureSuggestion(name, callLanguage, accessNeed),
      ...playbookFactSuggestions(facts, callLanguage, playbookId),
    ];
  }

  switch (intent) {
    case "confused":
      return [
        returnToPurposeSuggestion(callLanguage, playbookId),
        explainRelaySuggestion(callLanguage, accessNeed),
        whyCallingSuggestion(callLanguage, playbookId),
      ];
    case "ask-name":
    case "greeting":
      return [
        disclosureSuggestion(name, callLanguage, accessNeed),
        whyCallingSuggestion(callLanguage, playbookId),
      ];
    case "hold":
      return [
        pleaseContinueSuggestion(callLanguage),
        whyCallingSuggestion(callLanguage, playbookId),
      ];
    case "ask-id":
      return idSuggestions(facts, callLanguage, playbookId);
    case "ask-place":
      return placeSuggestions(facts, callLanguage, playbookId);
    case "ask-when":
      return whenSuggestions(facts, callLanguage, playbookId);
    case "ask-problem":
      return [
        stateIssueSuggestion(facts, callLanguage, playbookId),
        whyCallingSuggestion(callLanguage, playbookId),
      ];
    case "ask-details":
      return playbookFactSuggestions(facts, callLanguage, playbookId);
    default:
      if (isOffTask(caption, playbookId)) {
        return [
          returnToPurposeSuggestion(callLanguage, playbookId),
          whyCallingSuggestion(callLanguage, playbookId),
          askWhatNeededSuggestion(callLanguage),
        ];
      }
      return [
        whyCallingSuggestion(callLanguage, playbookId),
        pleaseContinueSuggestion(callLanguage),
        stateIssueSuggestion(facts, callLanguage, playbookId),
      ];
  }
}

const UNSOLICITED_FACT_DUMP =
  /consumer number|उपभोक्ता|account or card|खाता या कार्ड|complaint number|शिकायत संख्या|my area|मेरा क्षेत्र|hospital name|patient name|give my (consumer|area|account|bank)/i;

export function looksLikeUnsolicitedFactDump(item: ReplySuggestion): boolean {
  return UNSOLICITED_FACT_DUMP.test(`${item.label} ${item.sentence}`);
}

export function keepCaptionRelevant(
  caption: string,
  suggestions: ReplySuggestion[]
): ReplySuggestion[] {
  const intent = detectClerkIntent(caption);
  if (ASKED_FOR_FACTS.includes(intent)) return suggestions;
  return suggestions.filter((item) => !looksLikeUnsolicitedFactDump(item));
}

export function finalizeReplySuggestions({
  facts,
  callLanguage,
  playbookId,
  caption,
  name,
  accessNeed,
  llm = [],
}: {
  facts: Record<string, string>;
  callLanguage: CallLanguage;
  playbookId: string;
  caption: string;
  name: string;
  accessNeed?: AccessNeed;
  llm?: ReplySuggestion[];
}): ReplySuggestion[] {
  const fallback = contextualSuggestions(
    facts,
    callLanguage,
    playbookId,
    caption,
    name,
    accessNeed
  );
  if (!caption.trim()) return fallback;

  const relevant = keepCaptionRelevant(caption, llm);
  const merged: ReplySuggestion[] = [];
  const seen = new Set<string>();
  const add = (item: ReplySuggestion) => {
    const sentence = item.sentence.trim();
    if (!sentence) return;
    const key = sentence.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({ ...item, sentence });
  };
  for (const item of relevant) add(item);
  if (merged.length < 3) {
    for (const item of fallback) add(item);
  }
  return ensurePurposeSteer(caption, playbookId, callLanguage, merged);
}

export function alwaysPresentSuggestions(
  callLanguage: CallLanguage
): ReplySuggestion[] {
  const give = giveFor(callLanguage);

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
