export default function ISLAvatar({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-[var(--setu-line)] bg-[#1a2230] text-[#d7e0ea]">
      <span className="text-sm font-medium tracking-wide">ISL avatar</span>
    </div>
  );
}
