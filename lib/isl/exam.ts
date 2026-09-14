import { captionToGloss, scoreGloss } from "./mapGloss";

/** Clerk lines the three playbooks actually hear. Homework list for dictionary coverage. */
export const PLAYBOOK_EXAM: Record<string, string[]> = {
  "power-cut": [
    "Please give me your consumer number.",
    "There is a power cut in your area.",
    "Power has been out since morning.",
    "I am registering a complaint.",
    "Your complaint number is COMP-4821.",
    "Please hold.",
    "Please repeat.",
    "I did not understand.",
    "An engineer will visit today.",
    "No electricity since yesterday.",
    "What is your area?",
    "The line is down.",
    "We will send an electrician tomorrow evening.",
    "How long has the power been out?",
    "Please wait.",
    "Thank you.",
    "The problem is with the transformer.",
    "Load shedding until night.",
    "Please confirm your name.",
    "Call back later.",
    "बिजली गुल है सुबह से।",
    "आपकी शिकायत संख्या नोट करें।",
  ],
  bank: [
    "Which bank is this about?",
    "Tell me the last four digits of the card.",
    "Unauthorized transaction on your account.",
    "We will block the card.",
    "Report this to cyber crime 1930.",
    "Please hold the line.",
    "I need your name.",
    "When did this happen?",
    "Money has been sent.",
    "This looks like fraud.",
    "Do not share OTP.",
    "Please wait, transferring.",
    "A ticket number will be given.",
    "Thank you for calling.",
    "The amount is wrong.",
    "I understand.",
    "Please speak slowly.",
    "Your complaint is registered.",
    "We can refund the payment.",
    "The officer will call you later.",
  ],
  hospital: [
    "Which hospital?",
    "What is the patient name?",
    "Do you need an ambulance?",
    "This is an emergency.",
    "The doctor is available today.",
    "No beds available.",
    "Please come to the clinic.",
    "The operation is tomorrow morning.",
    "A nurse will call you.",
    "Do you have fever?",
    "Heart problem.",
    "Was there an accident?",
    "Please hold.",
    "I did not understand, please repeat.",
    "Your appointment is booked.",
    "Go to the laboratory for a test.",
    "Injection in the evening.",
    "Thank you.",
    "Wait, I will check.",
    "The ward is full.",
  ],
};

export type ExamLineResult = {
  playbookId: string;
  caption: string;
  gloss: string[];
  signed: number;
  spelled: number;
  rate: number;
};

export function runPlaybookExam(): {
  lines: ExamLineResult[];
  rate: number;
  spelledTokens: string[];
} {
  const lines: ExamLineResult[] = [];
  const spelledTokens: string[] = [];
  let signed = 0;
  let spelled = 0;

  for (const [playbookId, captions] of Object.entries(PLAYBOOK_EXAM)) {
    for (const caption of captions) {
      const gloss = captionToGloss(caption);
      const score = scoreGloss(gloss);
      signed += score.signed;
      spelled += score.spelled;
      for (const token of gloss) {
        if (token.length === 1) spelledTokens.push(token);
      }
      lines.push({
        playbookId,
        caption,
        gloss,
        signed: score.signed,
        spelled: score.spelled,
        rate: score.rate,
      });
    }
  }

  const total = signed + spelled;
  return {
    lines,
    rate: total === 0 ? 0 : signed / total,
    spelledTokens,
  };
}
