"use client";

import { useEffect, useRef } from "react";

interface Props {
  gloss?: string[];
  visible?: boolean;
}

declare global {
  interface Window {
    CWASAPlayer?: {
      init: (containerId: string, configUrl: string) => void;
      playSiGMLText: (sigml: string) => void;
      playSiGMLURL: (url: string) => void;
    };
  }
}

export default function ISLAvatar({ gloss = [], visible = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerReady = useRef(false);

  useEffect(() => {
    if (playerReady.current) return;
    const script = document.createElement("script");
    script.src = "/isl/js/allcsa.min.js";
    script.async = true;
    script.onload = () => {
      if (window.CWASAPlayer && containerRef.current) {
        window.CWASAPlayer.init(
          containerRef.current.id,
          "/isl/js/cwaclientcfg.json"
        );
        playerReady.current = true;
      }
    };
    document.head.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, []);

  useEffect(() => {
    if (!playerReady.current || !window.CWASAPlayer || gloss.length === 0) return;
    void (async () => {
      for (const word of gloss) {
        const url = `/isl/SignFiles/${encodeURIComponent(word)}.sigml`;
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            window.CWASAPlayer!.playSiGMLURL(url);
          } else {
            for (const char of word.toUpperCase()) {
              const charUrl = `/isl/SignFiles/${encodeURIComponent(char)}.sigml`;
              window.CWASAPlayer!.playSiGMLURL(charUrl);
            }
          }
        } catch {
          // Skip unknown signs.
        }
      }
    })();
  }, [gloss]);

  if (!visible) return null;

  return (
    <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-ink text-paper/70">
      <div
        id="cwasa-player-container"
        ref={containerRef}
        className="h-full w-full"
      />
    </div>
  );
}
