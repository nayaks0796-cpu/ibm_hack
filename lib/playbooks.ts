import powerCutJson from "@/playbooks/power-cut.json";
import bankJson from "@/playbooks/bank.json";
import hospitalJson from "@/playbooks/hospital.json";
import { getUiLanguage } from "./i18n";
import type { Playbook } from "./types";

export const POWER_CUT: Playbook = powerCutJson as Playbook;
export const BANK: Playbook = bankJson as Playbook;
export const HOSPITAL: Playbook = hospitalJson as Playbook;

export const PLAYBOOKS: Playbook[] = [POWER_CUT, BANK, HOSPITAL];

export function getPlaybook(id: string): Playbook | null {
  return PLAYBOOKS.find((playbook) => playbook.id === id) ?? null;
}

export function playbookTitle(playbook: Playbook, lang = getUiLanguage()): string {
  return playbook.title[lang] ?? playbook.title.en;
}

export function playbookGoal(playbook: Playbook, lang = getUiLanguage()): string {
  return playbook.goal[lang] ?? playbook.goal.en;
}
