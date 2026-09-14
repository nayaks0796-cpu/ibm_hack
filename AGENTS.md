# AGENTS.md — The Sampark Contract

Every agent (IBM Bob, Cursor, Antigravity) and every human on this team builds against this file.
If a behaviour is not defined here, DO NOT invent it — ask Tanis.

## What Sampark is

Sampark is a web app that acts as the ears and mouth of a deaf or non-verbal person on one
official phone call (electricity board, bank, hospital, cyber helpline 1930), ending in a
complaint/reference number. The clerk on the other side uses a normal phone and installs nothing.

The clerk's voice becomes live captions and ISL (Indian Sign Language) avatar animation.
The user replies by tapping a suggestion and pressing Send, or by unmuting and speaking.

## The four hard rules (breaking any of these = the feature is wrong)

1. **Nothing is spoken without Send.** The app never auto-replies. The user taps a reply
   suggestion, sees the exact sentence, and taps Send. Only then does TTS speak.
2. **OTP/PIN guard.** Sampark never speaks an OTP, PIN, CVV, or password through TTS, even if
   asked. These are also redacted (shown as ••••) in the saved transcript.
3. **The outcome card is the product.** After the call, the user sees ONE card: reference
   number on top, result (resolved/refused/incomplete), time. Full transcript is available
   behind a collapsed "View full conversation" — never the default view.
4. **Transport abstraction.** All audio in/out goes through the `AudioTransport` interface.
   `RoomTransport` = mic/speaker (demo). `ExotelTransport` = real phone call (phase 2).
   No screen or component may talk to a mic, speaker, or phone API directly.

## Additional product rules

- **Unmute = one entity.** If the user unmutes and speaks, any playing TTS is cancelled
  instantly (barge-in). Their speech is captioned into the transcript on OUR side, labeled
  `You`. The LLM treats it as something we already said and continues from there — it never
  repeats or re-speaks what the user just said.
- **No invented facts.** The LLM may only use facts the user typed in setup/start screens.
  If a needed fact is missing, the suggestion is "I will check and tell you" — never a
  made-up number or name.
- **Terminology: "reply suggestions."** Never call them chips in UI text, code comments,
  commits, or docs. Component name: `ReplySuggestions`.
- **Complaint number capture.** When a caption contains something that looks like a
  reference number, show "Heard COMP-4821 — pin this?" and pin only after user confirms.
- **Always-present suggestions** on the live call screen, regardless of LLM state:
  Wait / Please repeat / I did not understand / Please give the complaint number.
- **Silence indicator.** Visual ring showing line active vs silent vs disconnected — a deaf
  user cannot hear hold music.
- **Disclosure line.** First TTS line of every call includes: the user's name and
  "I am speaking through an assistive relay."
- **Privacy.** All user data (facts, transcripts, outcomes) lives in localStorage/IndexedDB.
  No accounts. No server-side database.

## The stack (locked — do not substitute)

| Job | Service | Notes |
|---|---|---|
| Captions (STT) | ElevenLabs Scribe v2 Realtime (`scribe_v2_realtime`) | Hindi + English + mixed; keyterm prompting with user facts |
| STT backup | IBM Watson STT (`hi-IN_Telephony` / `en-IN_Telephony`) | Auto-switch when ElevenLabs returns a quota/credit error; show "backup captions" note |
| Speech out (TTS) | ElevenLabs (`eleven_flash_v2_5`, or `eleven_multilingual_v2` if latency allows) | One voice speaks both Hindi and English; server proxy only |
| Last-resort TTS | Browser `speechSynthesis` | Only if ElevenLabs fails; show "demo voice" banner |
| LLM | Llama 3.3 70B Instruct on IBM watsonx.ai | Reply suggestions, fact/number extraction, ISL gloss. Temperature ~0.2, JSON output only |
| ISL avatar | CWASA SiGML player + sign files vendored from github.com/shoebham/text_to_isl | Unknown words fingerspell; credit the repo in README |
| Phone (phase 2) | Exotel Connect API + AgentStream bidirectional WSS | Trial: verified numbers only |
| Frontend | Next.js (App Router, TypeScript, Tailwind), PWA | `next-intl` for 8 UI languages |

**UI languages (8):** English, Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali.
**Call languages (2):** Hindi, English. Do not add more call languages.

## The four screens

1. **Setup (once)** — name; saved facts (consumer number, area, bank name, hospital name);
   UI language (8); call language (hi/en); voice choice; ISL avatar on/off.
2. **Start a call** — situation cards (Power cut / Bank-1930 / Hospital); confirm/edit facts
   as short buttons; big Call button.
3. **Live call** — caption feed (clerk side + our side); ISL avatar panel (toggleable);
   3–5 LLM reply suggestions + the 4 always-present ones; Send button showing the exact
   sentence; Unmute button; DTMF keypad; silence indicator; pin-number confirmation banner.
4. **Outcome card** — reference number, result, playbook name, duration; collapsed
   "View full conversation" (redacted); "New call" button. Saved on device.

## Repo structure

```
setu/
  app/                    # Next.js routes: / (setup), /start, /call, /outcome
  components/             # CaptionFeed, ReplySuggestions, ISLAvatar, DTMFPad,
                          # OutcomeCard, SilenceRing, UnmuteButton
  lib/
    transport/            # AudioTransport interface, RoomTransport, ExotelTransport (stub)
    elevenlabs/           # scribe client (browser, token-based), tts client
    watsonx/              # Llama client: suggest(), extractFacts(), gloss()
    watson-stt/           # backup STT client + auto-switch logic
    guard/                # OTP/PIN blocker, reference-number detector, redaction
    store/                # localStorage/IndexedDB helpers
  server/                 # API routes: scribe-token, tts, suggest, gloss, stt-fallback
  public/isl/             # CWASA player + SiGML files (vendored)
  playbooks/              # power-cut.json, bank.json, hospital.json
  messages/               # i18n strings: en.json, hi.json, ta.json, te.json,
                          # kn.json, ml.json, mr.json, bn.json
  docs/bob-log/           # screenshots of every IBM Bob session
  AGENTS.md               # this file
  TEAM_GUIDE.md           # who builds what, how to use agents
```

## API endpoints (server/)

- `POST /api/scribe-token` → `{ token }` — short-lived ElevenLabs Scribe token. Never expose the API key to the browser.
- `POST /api/tts` body `{ text, lang }` → streamed audio. Must support immediate cancellation (barge-in).
- `POST /api/suggest` body `{ caption, history, facts, goal, callLanguage }` → see JSON shape below.
- `POST /api/gloss` body `{ text }` → `{ gloss: ["MORNING", "POWER", "CUT"] }` (English uppercase words for the ISL avatar).
- `WS /api/stt-fallback` — Watson STT proxy, same message shape as the Scribe client emits, so the caption feed cannot tell which engine is on.

## JSON shapes (do not deviate)

**Playbook** (`playbooks/*.json`):
```json
{
  "id": "power-cut",
  "icon": "zap",
  "title": { "en": "Power cut", "hi": "बिजली गुल" },
  "goal": { "en": "Get a complaint number for the power cut", "hi": "बिजली कटौती की शिकायत संख्या प्राप्त करें" },
  "defaultCallLanguage": "hi",
  "facts": [
    { "key": "consumer_number", "label": { "en": "Consumer number" }, "required": true },
    { "key": "area", "label": { "en": "Area / colony" }, "required": true },
    { "key": "since_when", "label": { "en": "Since when" }, "required": false }
  ]
}
```

**Reply suggestion response** (`/api/suggest`):
```json
{
  "suggestions": [
    {
      "id": "s1",
      "label": "Give my consumer number",
      "sentence": "मेरा उपभोक्ता क्रमांक 1234567890 है।"
    }
  ]
}
```
`label` is in the UI language (short, for the button). `sentence` is in the call language
(exactly what TTS will speak). 3–5 suggestions. No prose around the JSON.

**Transcript entry:**
```json
{ "t": 1757745000000, "side": "clerk", "source": "stt", "text": "...", "redacted": false }
```
`side`: `"clerk" | "us"`. `source`: `"stt" | "tts-sent" | "user-voice" | "dtmf" | "system"`.

**Outcome:**
```json
{
  "playbookId": "power-cut",
  "startedAt": 0, "endedAt": 0,
  "result": "resolved",
  "referenceNumber": "COMP-4821",
  "transcript": []
}
```
`result`: `"resolved" | "refused" | "no-answer" | "incomplete"`.

## Guard rules (lib/guard)

- **Block from TTS**: any digit sequence of 3+ within 40 chars after (case/lang-insensitive)
  OTP / ओटीपी / PIN / पिन / CVV / password / पासवर्ड. Blocked send shows: "Sampark will not
  speak codes. Unmute to say it yourself."
- **Reference-number detector**: patterns like `[A-Z]{2,6}[-/ ]?\d{4,12}`, standalone 6–13
  digit numbers following words like complaint/शिकायत/reference/ticket/registration.
- **Redaction**: same trigger words → digits become `••••` in stored transcript.

## Environment variables (.env.local — never committed)

```
ELEVENLABS_API_KEY=
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL=meta-llama/llama-3-3-70b-instruct
WATSON_STT_API_KEY=
WATSON_STT_URL=
```

## Build order (each step gated on the previous — see plan)

1. Contract + scaffold → 2. Clickable skeleton (fake data) → 3. ISL avatar boots →
4. Scribe captions → 5. ElevenLabs TTS + barge-in → 6. Llama reply suggestions →
7. Guards → 8. Watson backup switch → 9. ISL gloss live → 10. Bank + hospital playbooks,
DTMF, failure states → 11. 8 UI languages → 12. Demo hardening → 13. Exotel (stretch).

## Deliberately cut (do not build)

Public +91 dialling, incoming calls, more call languages, voice cloning, tone detection,
model training/fine-tuning, accounts/login, server-side DB, transcript-as-homepage.

## Commit conventions

- Work done in IBM Bob: prefix `bob:` (e.g. `bob: watsonx client + suggestion prompt`).
- Everything else: `feat:` / `fix:` / `chore:` with the module name.
- Screenshot every Bob session into `docs/bob-log/` before closing it.
- `main` is owned by Tanis. Run the call loop once before merging anything into it.
