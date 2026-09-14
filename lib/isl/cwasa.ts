// CWASA SiGML player — vendored allcsa.js from UEA vhg2026z (client-side Animgen).
// Modern public API takes SiGML text first, optional avatar index second:
//   playSiGMLURL(url, av?) / playSiGMLText(text, av?) / stopSiGML(av?)
// Sign files remain from shoebham/text_to_isl under /isl/SignFiles/.

import { getSignFile, getSignIndex } from "./catalog";
import { alignGlossToCatalog } from "./mapGloss";

declare global {
  interface Window {
    CWASA?: {
      init: (cfg?: Record<string, unknown>) => void;
      playSiGMLURL: (url: string, av?: number) => string;
      playSiGMLText: (text: string, av?: number) => string;
      stopSiGML: (av?: number) => string;
    };
  }
}

/** UEA JASigning assets (avatar JARs). CORS is open (*). */
const JAS_BASE = "https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026z/";

let bootPromise: Promise<void> | null = null;

export function loadSignIndex(): Promise<Map<string, string>> {
  return Promise.resolve(getSignIndex());
}

function loadCss(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-cwasa="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/isl/css/cwasa.css";
  link.dataset.cwasa = "1";
  document.head.appendChild(link);
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("CWASA is browser-only"));
  }
  if (window.CWASA) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cwasa="1"]');
    if (existing) {
      if (window.CWASA) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("CWASA script failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    // vhg2026z allcsa.js includes client-side Animgen (no UEA CGI needed).
    script.src = "/isl/js/allcsa.js";
    script.async = true;
    script.dataset.cwasa = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("CWASA script failed"));
    document.head.appendChild(script);
  });
}

function waitFor(selector: string, timeoutMs: number): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const started = Date.now();
    const tick = () => {
      const node = document.querySelector(selector);
      if (node) {
        resolve(node);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`${selector} not found`));
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

export function bootCwasa(): Promise<void> {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    loadCss();
    await Promise.all([loadScript(), loadSignIndex()]);
    if (!window.CWASA) throw new Error("CWASA missing after script load");

    await waitFor(".CWASAAvatar.av0", 4000);

    // Omit animgenServer so vhg2026z uses built-in client Animgen.
    // (UEA's animgenserver.pl currently returns 500.)
    if (!document.querySelector(".CWASAAvatar.av0 canvas")) {
      window.CWASA.init({
        jasBase: JAS_BASE,
        avSettings: {
          width: 320,
          height: 280,
          avList: "avs",
          initAv: "anna",
          background: "#171716",
          initSiGMLURL: "",
          allowSiGMLText: false,
          allowFrameSteps: false,
          ambIdle: true,
        },
      });
    }

    await waitFor(".CWASAAvatar.av0 canvas", 20000);
    // Give the avatar mesh a moment to finish loading before the boot sign.
    await new Promise((r) => window.setTimeout(r, 600));
    try {
      playSigml(await glossToSigml(["hello"]));
    } catch {
      // Avatar is up even if the test sentence cannot play yet.
    }
  })().catch((error) => {
    bootPromise = null;
    throw error;
  });

  return bootPromise;
}

async function fetchSignXml(fileName: string): Promise<string | null> {
  const res = await fetch(`/isl/SignFiles/${encodeURIComponent(fileName)}`);
  if (!res.ok) return null;
  const text = await res.text();
  const inner = text.replace(/<\/?sigml>/gi, "").trim();
  return inner || null;
}

export async function glossToSigml(gloss: string[]): Promise<string> {
  const aligned = alignGlossToCatalog(gloss);
  const parts: string[] = [];

  for (const raw of aligned) {
    const word = raw.trim();
    if (!word) continue;

    const file = getSignFile(word);
    if (file) {
      const xml = await fetchSignXml(file);
      if (xml) parts.push(xml);
      continue;
    }

    for (const ch of word.toUpperCase()) {
      if (!/[A-Z0-9]/.test(ch)) continue;
      const letterFile = getSignFile(ch) ?? `${ch}.sigml`;
      const xml = await fetchSignXml(letterFile);
      if (xml) parts.push(xml);
    }
  }

  return `<sigml>\n${parts.join("\n")}\n</sigml>`;
}

export function playSigml(sigml: string): void {
  if (!window.CWASA || !/<hns_sign|<hamnosys/i.test(sigml)) return;
  window.CWASA.stopSiGML(0);
  // vhg2026z: (text, av?) — not the old (av, text) order.
  window.CWASA.playSiGMLText(sigml, 0);
}
