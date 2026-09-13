import powerCutJson from "@/playbooks/power-cut.json";
import type { Playbook } from "./types";

export const POWER_CUT: Playbook = powerCutJson as Playbook;

export function getPlaybook(id: string): Playbook | null {
  if (id === POWER_CUT.id) return POWER_CUT;
  return null;
}

export function playbookTitle(playbook: Playbook, lang = "en"): string {
  return playbook.title[lang] ?? playbook.title.en;
}
