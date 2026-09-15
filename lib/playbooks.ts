import powerCutJson from "@/playbooks/power-cut.json";
import bankJson from "@/playbooks/bank.json";
import hospitalJson from "@/playbooks/hospital.json";
import waterJson from "@/playbooks/water.json";
import gasJson from "@/playbooks/gas.json";
import cardBlockJson from "@/playbooks/card-block.json";
import labReportJson from "@/playbooks/lab-report.json";
import bedInquiryJson from "@/playbooks/bed-inquiry.json";
import rationJson from "@/playbooks/ration.json";
import aadhaarJson from "@/playbooks/aadhaar.json";
import pensionJson from "@/playbooks/pension.json";
import certificateJson from "@/playbooks/certificate.json";
import firFileJson from "@/playbooks/fir-file.json";
import firFollowupJson from "@/playbooks/fir-followup.json";
import legalAidJson from "@/playbooks/legal-aid.json";
import emergency112Json from "@/playbooks/emergency-112.json";
import ambulance108Json from "@/playbooks/ambulance-108.json";
import fire101Json from "@/playbooks/fire-101.json";
import { getUiLanguage } from "./i18n";
import type {
  CallLanguage,
  Playbook,
  PlaybookCategory,
  PlaybookChannel,
  PlaybookStage,
} from "./types";

export const POWER_CUT: Playbook = powerCutJson as Playbook;
export const BANK: Playbook = bankJson as Playbook;
export const HOSPITAL: Playbook = hospitalJson as Playbook;

export const PLAYBOOKS: Playbook[] = [
  emergency112Json,
  ambulance108Json,
  fire101Json,
  powerCutJson,
  waterJson,
  gasJson,
  bankJson,
  cardBlockJson,
  hospitalJson,
  labReportJson,
  bedInquiryJson,
  rationJson,
  aadhaarJson,
  pensionJson,
  certificateJson,
  firFileJson,
  firFollowupJson,
  legalAidJson,
] as Playbook[];

export const PLAYBOOK_CATEGORIES: PlaybookCategory[] = [
  "emergency",
  "utility",
  "money",
  "health",
  "government",
  "legal",
];

export function getPlaybook(id: string): Playbook | null {
  return PLAYBOOKS.find((playbook) => playbook.id === id) ?? null;
}

export function playbookTitle(playbook: Playbook, lang = getUiLanguage()): string {
  return playbook.title[lang] ?? playbook.title.en;
}

export function playbookGoal(playbook: Playbook, lang = getUiLanguage()): string {
  return playbook.goal[lang] ?? playbook.goal.en;
}

export function playbookCategory(playbook: Playbook): PlaybookCategory {
  return playbook.category ?? "utility";
}

export function playbookChannel(playbook: Playbook): PlaybookChannel {
  return playbook.channel ?? "phone-human";
}

export function isEmergencyPlaybook(playbook: Playbook | null | undefined): boolean {
  return Boolean(playbook?.emergency);
}

export function playbooksInCategory(category: PlaybookCategory): Playbook[] {
  return PLAYBOOKS.filter((item) => playbookCategory(item) === category);
}

export function emergencyPlaybooks(): Playbook[] {
  return PLAYBOOKS.filter((item) => item.emergency);
}

/** Typical stages as a numbered map for the LLM. Not a transcript. */
export function formatPlaybookStages(
  stages: PlaybookStage[] | undefined,
  callLanguage: CallLanguage
): string {
  if (!stages?.length) return "";
  return stages
    .map((stage, index) => {
      const line = callLanguage === "hi" ? stage.hi || stage.en : stage.en;
      return `${index + 1}. ${line}`;
    })
    .join("\n");
}

export function playbookKeyterms(playbook: Playbook | null | undefined): string[] {
  return playbook?.keyterms?.filter(Boolean) ?? [];
}
