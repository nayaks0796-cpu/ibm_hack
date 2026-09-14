export default function ISLAvatar({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-[1.5rem] border border-[var(--border)] bg-ink text-paper/70">
      <span className="text-sm font-medium tracking-wide">ISL avatar</span>
    </div>
  );
}
