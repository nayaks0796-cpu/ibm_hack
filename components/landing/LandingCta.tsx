"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasCompletedSetup } from "@/lib/store";

export default function LandingCta({
  label,
  className = "gold-btn",
}: {
  label: string;
  className?: string;
}) {
  const [href, setHref] = useState("/setup");

  useEffect(() => {
    setHref(hasCompletedSetup() ? "/start" : "/setup");
  }, []);

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
