import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Setu — Assistive Relay",
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
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
