// CWASA SiGML player — vendored allcsa.js from UEA vhg2026z (client-side Animgen).
// Modern public API takes SiGML text first, optional avatar index second:
//   playSiGMLURL(url, av?) / playSiGMLText(text, av?) / stopSiGML(av?)
// Sign files remain from shoebham/text_to_isl under /isl/SignFiles/.

import { getSignFile, getSignIndex } from "./catalog";
import { alignGlossToCatalog } from "./mapGloss";

declare global {
  interface Window {
    CWASA?: {
      init: (cfg?: Record<string, unknown>) => Promise<void> | void;
      ready?: Promise<void>;
      playSiGMLURL: (url: string, av?: number) => string;
      playSiGMLText: (text: string, av?: number) => string;
      stopSiGML: (av?: number) => string;
    };
  }
}

/** Same-origin proxy so avatar JARs and shaders are not blocked by CORS. */
const JAS_BASE = "/api/jas/";
const HOST_ID = "sampark-cwasa-host";

let bootPromise: Promise<void> | null = null;

export function loadSignIndex(): Promise<Map<string, string>> {
  return Promise.resolve(getSignIndex());
}

/** Keep the CWASA node outside React so Strict Mode remounts cannot destroy WebGL. */
export function ensureCwasaHost(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.className = "CWASAAvatar av0";
    host.style.width = "100%";
    host.style.height = "100%";
    document.body.appendChild(host);
  }
  return host;
}

function parkCwasaHost(): void {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  host.style.position = "fixed";
  host.style.left = "-9999px";
  host.style.top = "0";
  host.style.width = "320px";
  host.style.height = "280px";
  document.body.appendChild(host);
}

export function attachCwasaHost(slot: HTMLElement): HTMLElement {
  const host = ensureCwasaHost();
  host.style.position = "relative";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "100%";
  host.style.height = "100%";
  host.style.display = "block";
  slot.appendChild(host);
  return host;
}

export function detachCwasaHost(slot: HTMLElement): void {
  const host = document.getElementById(HOST_ID);
  if (host && host.parentNode === slot) parkCwasaHost();
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
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-cwasa="1"]'
    );
    if (existing) {
      if (window.CWASA) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("CWASA script failed")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
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

export function avatarCanvasReady(): boolean {
  return Boolean(document.querySelector("#sampark-cwasa-host canvas, .CWASAAvatar.av0 canvas"));
}

export function bootCwasa(): Promise<void> {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    ensureCwasaHost();
    loadCss();
    await Promise.all([loadScript(), loadSignIndex()]);
    if (!window.CWASA) throw new Error("CWASA missing after script load");

    await waitFor(".CWASAAvatar.av0", 4000);

    if (!avatarCanvasReady()) {
      const ready = window.CWASA.init({
        jasBase: JAS_BASE,
        useCwaConfig: true,
        avSettings: {
          width: 320,
          height: 280,
          avList: "avs",
          initAv: "anna",
          background: "#171716",
          initSiGMLURL: "",
          allowSiGMLText: true,
          allowFrameSteps: false,
          ambIdle: true,
        },
      });
      if (ready && typeof (ready as Promise<void>).then === "function") {
        await ready;
      }
    } else if (window.CWASA.ready) {
      await window.CWASA.ready;
    }

    await waitFor(".CWASAAvatar.av0 canvas", 45000);
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
  try {
    window.CWASA.stopSiGML(0);
    window.CWASA.playSiGMLText(sigml, 0);
  } catch {
    // Animgen throws if the avatar JAR is still loading; gloss still shows.
  }
}
