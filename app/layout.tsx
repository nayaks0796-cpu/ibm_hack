import type { Metadata } from "next";
import { Figtree, Instrument_Serif } from "next/font/google";
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
  title: "Setu — a phone relay for deaf and non-verbal India",
  description:
    "Setu helps deaf and non-verbal people make official phone calls via live captions and reply suggestions.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${instrument.variable}`}>
      <body className="min-h-screen overflow-x-hidden bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
