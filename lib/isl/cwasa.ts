// CWASA SiGML player — vendored allcsa.js from UEA vhg2026z (client-side Animgen).
// Modern public API takes SiGML text first, optional avatar index second:
//   playSiGMLURL(url, av?) / playSiGMLText(text, av?) / stopSiGML(av?)
// Sign files remain from shoebham/text_to_isl under /isl/SignFiles/.

import { getSignFile, getSignIndex } from "./catalog";
import { alignGlossToCatalog } from "./mapGloss";

type CwasaHookEvt = { typ?: string; av?: number; msg?: string };

declare global {
  interface Window {
    CWASA?: {
      init: (cfg?: Record<string, unknown>) => Promise<void> | void;
      ready?: Promise<void>;
      playSiGMLURL: (url: string, av?: number) => string;
      playSiGMLText: (text: string, av?: number) => string;
      stopSiGML: (av?: number) => string;
      addHook?: (name: string, fn: (evt?: CwasaHookEvt) => void) => void;
    };
    getCWAEnv?: () => { get: (name: string) => any };
  }
}

function isAnimgenNoise(value: unknown): boolean {
  const msg = String(value ?? "");
  return /animgen|jagid|allcsa|animgenAllocate/i.test(msg);
}

// Animgen logs "animgenAllocate: jagid: 0" on success. Next.js treats console.error
// as an overlay issue and overlapping plays then deadlock in Alloc.
if (typeof window !== "undefined") {
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (args.some(isAnimgenNoise)) {
      console.debug(...args);
      return;
    }
    origError(...args);
  };

  window.addEventListener(
    "error",
    (event) => {
      const msg = event?.message ? String(event.message) : "";
      if (isAnimgenNoise(msg)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (isAnimgenNoise(event?.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
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
  host.style.visibility = "visible";
  if (host.parentNode !== slot) slot.appendChild(host);
  return host;
}

export function detachCwasaHost(slot: HTMLElement): void {
  const host = document.getElementById(HOST_ID);
  if (host && host.parentNode === slot) parkCwasaHost();
}

/** After the avatar slot returns on-screen, nudge CWASA so WebGL redraws. */
export function refreshCwasaLayout(): void {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  void host.offsetWidth;
  const canvas = host.querySelector("canvas");
  if (canvas instanceof HTMLCanvasElement) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }
  window.dispatchEvent(new Event("resize"));
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
    await prepareAnimgen();
  })().catch((error) => {
    bootPromise = null;
    throw error;
  });

  return bootPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Wait until WASM Animgen, H-to-G XSLT, and Anna's JAR config are actually usable. */
async function prepareAnimgen(): Promise<void> {
  const env = window.getCWAEnv?.();
  if (!env?.get) return;

  try {
    const agi = env.get("AGI");
    if (agi?.Ready) await Promise.race([agi.Ready, sleep(8000)]);
  } catch {
    // Avatar still renders; first playSignWord will retry.
  }

  try {
    const xsltLoad = env.get("SigningAvatar")?.H2G?.XSLTProc?.load;
    if (xsltLoad) await Promise.race([xsltLoad, sleep(8000)]);
  } catch {
    // HtoG may still load in the background.
  }

  try {
    const AvCache = env.get("AvCache");
    const common = AvCache?.get?.("COMMON");
    const anna = AvCache?.get?.("anna");
    if (common?.getZIPEnt && anna?.getZIPEnt) {
      await Promise.race([
        Promise.all([
          common.getZIPEnt("config"),
          anna.getZIPEnt("config"),
          anna.getZIPEnt("asd"),
          anna.getZIPEnt("nonManuals"),
        ]),
        sleep(15000),
      ]);
    }
  } catch {
    // PrepInstance will fetch JARs on the first sign if prefetch fails.
  }

  installPlayHooks();
}

const AGI_STATE_ALLOC = 2;
const AGI_STATE_AVATAR_SET = 3;
const AGI_STATE_SEQ_IN_PROGRESS = 5;

function resetStuckAnimgen(): void {
  try {
    const inst = window.getCWAEnv?.()?.get?.("AGI")?.Get?.(0);
    if (!inst) return;
    if (inst.state === AGI_STATE_ALLOC) {
      inst.DeAlloc?.();
    } else if (inst.state === AGI_STATE_SEQ_IN_PROGRESS) {
      inst.state = AGI_STATE_AVATAR_SET;
    }
  } catch {
    // Leave CWASA to recover on the next play.
  }
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

let playGate: Promise<void> = Promise.resolve();
let hooksInstalled = false;
const playWaiters = new Set<(typ: string, msg?: string) => void>();

function notifyPlay(typ: string, msg?: string): void {
  for (const waiter of [...playWaiters]) waiter(typ, msg);
}

function installPlayHooks(): void {
  if (hooksInstalled || !window.CWASA?.addHook) return;
  hooksInstalled = true;
  const wrap =
    (fallback: string) =>
    (evt?: CwasaHookEvt) => {
      notifyPlay(evt?.typ || fallback, evt?.msg);
    };
  window.CWASA.addHook("sigmlloading", wrap("sigmlloading"));
  window.CWASA.addHook("sigmlloaded", wrap("sigmlloaded"));
  window.CWASA.addHook("animidle", wrap("animidle"));
  window.CWASA.addHook("status", wrap("status"));
}

function waitUntilPlaySettled(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let sawLoading = false;
    const timer = window.setTimeout(finish, timeoutMs);
    const waiter = (typ: string, msg?: string) => {
      if (
        typ === "sigmlloading" ||
        (typ === "status" && /SiGML Loading/i.test(msg || ""))
      ) {
        sawLoading = true;
        return;
      }
      const failed =
        typ === "status" &&
        /invalid|Cannot process|No valid|No signs|not loaded/i.test(msg || "");
      if (typ === "sigmlloaded" || typ === "animidle" || failed) {
        if (!sawLoading && typ === "animidle") return;
        finish();
      }
    };
    function finish() {
      window.clearTimeout(timer);
      playWaiters.delete(waiter);
      resolve();
    }
    playWaiters.add(waiter);
  });
}

async function playSigmlNow(sigml: string): Promise<void> {
  if (!window.CWASA || !/<hns_sign|<hamnosys/i.test(sigml)) return;
  await bootCwasa();
  installPlayHooks();
  resetStuckAnimgen();

  const settled = waitUntilPlaySettled(12000);
  let started = false;
  try {
    const result = window.CWASA.playSiGMLText?.(sigml, 0) ?? "";
    started = !/undefined avatar/i.test(result);
  } catch {
    started = false;
  }
  if (!started) {
    notifyPlay("sigmlloaded");
    return;
  }
  await settled;
}

export function playSigml(sigml: string): Promise<void> {
  const run = playGate.then(() => playSigmlNow(sigml));
  playGate = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function playSignWord(word: string): Promise<boolean> {
  const clean = word.trim();
  if (!clean) return false;

  const file = getSignFile(clean);
  let xml: string | null = null;
  if (file) {
    xml = await fetchSignXml(file);
  } else {
    const parts: string[] = [];
    for (const ch of clean.toUpperCase()) {
      if (!/[A-Z0-9]/.test(ch)) continue;
      const letterFile = getSignFile(ch) ?? `${ch}.sigml`;
      const x = await fetchSignXml(letterFile);
      if (x) parts.push(x);
    }
    if (parts.length > 0) xml = parts.join("\n");
  }

  if (xml) {
    await playSigml(`<sigml>\n${xml}\n</sigml>`);
    return true;
  }
  return false;
}
