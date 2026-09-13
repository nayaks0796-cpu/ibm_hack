// ISLAvatar — renders Indian Sign Language avatar using CWASA SiGML player.
// Receives a gloss array (e.g. ["MORNING", "POWER", "CUT"]) and animates signing.
// Unknown words are fingerspelled.
// ISL sign files vendored from github.com/shoebham/text_to_isl — credit in README.
// TODO: step 3 — boot CWASA player; step 9 — wire live gloss stream
export default function ISLAvatar() {
  return (
    <div className="w-full aspect-video bg-gray-100 flex items-center justify-center">
      {/* CWASA SiGML player mounted here */}
      <span className="text-gray-400 text-sm">ISL Avatar</span>
    </div>
  );
}
