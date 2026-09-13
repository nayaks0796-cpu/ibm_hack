// Live call screen (route: /call)
// Caption feed, ISL avatar panel, reply suggestions, Send button, Unmute, DTMF keypad,
// silence indicator, pin-number confirmation banner.
export default function CallPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">Live Call</h1>
      <p className="text-gray-500 text-sm">
        {/* TODO: step 2 — clickable skeleton */}
        Caption feed and reply suggestions will appear here during a call.
      </p>
    </main>
  );
}
