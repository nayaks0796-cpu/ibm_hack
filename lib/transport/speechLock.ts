// lib/transport/speechLock.ts
// Cross-tab speech deduplication lock to guarantee audio is played strictly once
// even if both the caller (/call) and clerk (/clerk) are open on the same computer.

export function tryClaimSpeech(msgId?: string, timeoutMs = 8000): boolean {
  if (!msgId || typeof window === "undefined") return true;

  const key = `sampark_speech_claimed_${msgId}`;
  try {
    const existing = sessionStorage.getItem(key) || localStorage.getItem(key);
    const now = Date.now();
    if (existing) {
      const ts = Number(existing);
      if (!isNaN(ts) && now - ts < timeoutMs) {
        return false; // Already claimed and spoken recently!
      }
    }
    sessionStorage.setItem(key, String(now));
    try {
      localStorage.setItem(key, String(now));
    } catch {}

    // Cleanup old key
    setTimeout(() => {
      try {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      } catch {}
    }, timeoutMs + 2000);

    return true;
  } catch {
    return true;
  }
}
