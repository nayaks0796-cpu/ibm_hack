// Standard DTMF frequencies. RoomTransport plays these; screens never touch audio APIs.

const DTMF_FREQ: Record<string, [number, number]> = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};

export const DTMF_MS = 160;

export function dtmfFrequencies(key: string): [number, number] | null {
  return DTMF_FREQ[key] ?? null;
}
