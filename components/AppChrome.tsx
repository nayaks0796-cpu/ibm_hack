import type { ReactNode } from "react";
import BrandMark from "@/components/BrandMark";

export default function AppChrome({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <BrandMark />
        {aside}
      </header>
      {children}
    </div>
  );
}
