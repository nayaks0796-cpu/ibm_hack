// Sign catalog from the vendored shoebham/text_to_isl SiGML files.
import sigmlFiles from "../../public/isl/js/sigmlFiles.json";

type SignRow = { fileName: string; name: string };

const rows = sigmlFiles as SignRow[];

const signIndex: Map<string, string> = new Map();
for (const row of rows) {
  const file = row.fileName;
  signIndex.set(row.name.toLowerCase(), file);
  signIndex.set(file.replace(/\.sigml$/i, "").toLowerCase(), file);
}

export function getSignIndex(): Map<string, string> {
  return signIndex;
}

export function hasSign(word: string): boolean {
  return signIndex.has(word.trim().toLowerCase());
}

export function getSignFile(word: string): string | undefined {
  return signIndex.get(word.trim().toLowerCase());
}

export function catalogLemma(word: string): string | null {
  const file = getSignFile(word);
  if (!file) return null;
  return file.replace(/\.sigml$/i, "").toLowerCase();
}
