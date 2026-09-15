// lib/transport/speechLock.ts
// Cross-tab speech deduplication lock to guarantee audio is played strictly once
// even if both the caller (/call) and clerk (/clerk) are open on the same computer.

export function tryClaimSpeech(msgId?: string, timeoutMs = 8000): boolean {
  if (!msgId || typeof window === "undefined") return true;

  const key = `sampark_speech_claimed_${msgId}`;
  try {
    // localStorage only — sessionStorage is per-tab and would let /clerk
    // replay the same utterance in a second voice on the same computer.
    const existing = localStorage.getItem(key);
    const now = Date.now();
    if (existing) {
      const ts = Number(existing);
      if (!isNaN(ts) && now - ts < timeoutMs) {
        return false; // Already claimed and spoken recently!
      }
    }
    localStorage.setItem(key, String(now));

    // Cleanup old key
    setTimeout(() => {
      try {
        localStorage.removeItem(key);
      } catch {}
    }, timeoutMs + 2000);

    return true;
  } catch {
    return true;
  }
}
