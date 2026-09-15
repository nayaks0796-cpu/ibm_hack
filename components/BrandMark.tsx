import Link from "next/link";

export function BridgeIcon({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      viewBox="6 16 108 76"
      width="32"
      height="32"
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-8 w-8 shrink-0 text-highlight-ink ${className}`}
      aria-hidden="true"
    >
      <line x1="16" y1="84" x2="104" y2="84" strokeWidth="7" />
      <line x1="40" y1="84" x2="40" y2="34" strokeWidth="6" />
      <line x1="80" y1="84" x2="80" y2="34" strokeWidth="6" />
      <line x1="16" y1="84" x2="40" y2="34" strokeWidth="4" />
      <line x1="104" y1="84" x2="80" y2="34" strokeWidth="4" />
      <line x1="50" y1="34" x2="50" y2="84" strokeWidth="2" opacity="0.5" />
      <line x1="60" y1="40" x2="60" y2="84" strokeWidth="2" opacity="0.5" />
      <line x1="70" y1="34" x2="70" y2="84" strokeWidth="2" opacity="0.5" />
      <path d="M40 34 q5 -12 10 0 t10 0 t10 0 t10 0" fill="none" strokeWidth="4.5" />
      <circle cx="16" cy="84" r="5" stroke="none" />
      <circle cx="104" cy="84" r="5" stroke="none" />
    </svg>
  );
}

export default function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 text-ink transition-opacity duration-200 hover:opacity-80"
    >
      <BridgeIcon />
      <span className="text-2xl font-semibold tracking-tight">Sampark</span>
    </Link>
  );
}
