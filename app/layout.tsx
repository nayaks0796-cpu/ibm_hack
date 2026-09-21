import type { Metadata, Viewport } from "next";
import { Figtree, Instrument_Serif } from "next/font/google";
import I18nProvider from "@/components/I18nProvider";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sampark — a phone relay for deaf and non-verbal India",
  description:
    "Sampark helps deaf and non-verbal people make official phone calls via live captions, ISL depiction, and reply suggestions.",
  applicationName: "Sampark",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Sampark",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e7c72" },
    { media: "(prefers-color-scheme: dark)",  color: "#111110" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${instrument.variable}`}>
      <head>
        <link rel="stylesheet" href="/sampark.css" />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-paper font-sans text-ink antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
