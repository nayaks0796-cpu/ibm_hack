import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Selector strategy: dark tokens activate when <html data-theme="dark">.
  // The theme script in layout.tsx sets this before first paint (no flash).
  // Falls back to OS preference when no data-theme is stored.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // These map to CSS custom properties so they flip automatically in dark mode.
        paper: "var(--color-paper)",
        ink: "var(--color-ink)",
        raised: "var(--color-raised)",
        card: "var(--color-card)",
        signal: "#0e7c72",
        highlight: "#f2b705",
        "highlight-ink": "#8a5a00",
        danger: "#b3452f",
      },
      fontFamily: {
        sans: ["var(--font-figtree)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-instrument)", "Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 18px 50px rgba(23, 23, 22, 0.06)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        wave: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-120px)" },
        },
        bar: {
          "0%, 100%": { transform: "scaleY(0.45)" },
          "50%": { transform: "scaleY(1.15)" },
        },
        softPulse: {
          "0%": { transform: "scale(0.7)", opacity: "0.45" },
          "80%": { opacity: "0" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        wave: "wave 5s linear infinite",
        bar: "bar 1s ease-in-out infinite",
        "soft-pulse": "softPulse 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
