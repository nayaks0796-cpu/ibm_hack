# TEAM_GUIDE.md — Who builds what, and how to use your agents

Three people, three modules, one contract. Read `AGENTS.md` first — it defines every
behaviour. If your agent wants to do something AGENTS.md doesn't define, stop and ask Tanis.

## Ownership

### Tanis — Cursor — integration lead + the live call loop
- `AGENTS.md` upkeep (only Tanis edits it)
- Live call screen: caption feed → reply suggestions → Send → TTS, Unmute barge-in
- Final integration, demo script, pitch
- Owns `main`: nothing merges without running the call loop once

### Arya — Antigravity — screens + content
- Setup, Start-a-call, and Outcome screens (per the four-screen spec in AGENTS.md)
- DTMF keypad component; failure states (silent clerk / refused / number captured)
- The three playbooks as JSON (`playbooks/`) — goal + facts only, no scripts
- 8-language UI strings (`messages/*.json`)

**Arya's definition of done:** all screens work with fake data and no API keys; every
visible string comes from `messages/`, not hardcoded; playbooks validate against the JSON
shape in AGENTS.md. Setup is prefs only; playbook facts live on Start + optional save on Outcome.

### Satyeta — Antigravity — plumbing + safety
- Server endpoints: `/api/scribe-token`, `/api/tts` (with cancellation), `/api/suggest`,
  `/api/gloss`, `/api/stt-fallback`
- `lib/guard/`: OTP/PIN blocker, reference-number detector, transcript redaction
- Watson STT auto-switch on ElevenLabs quota error
- ISL avatar vendoring: CWASA player + SiGML files into `public/isl/`, one test sentence
- Exotel stretch at the very end (only when steps 1–12 are green)

**Satyeta's definition of done:** each endpoint has a curl example that works; guard has
unit tests for "OTP is 482911" (blocked) and "complaint number COMP-4821" (detected);
killing the ElevenLabs key mid-session flips captions to Watson without a reload.

## Git repo

https://github.com/snk189/ibm_hack — this is the team repo. Clone it, do not start a second one.

## Git workflow

- Branches: `tanis/call-loop`, `arya/screens`, `satyeta/plumbing`. Small commits.
- Pull `main` every few hours. Merge conflicts mean two people touched one module — stop
  and re-split instead of fighting.
- Commit prefixes: `bob:` for IBM Bob work, otherwise `feat:` / `fix:` / `chore:`.

## How to use your coding agent (Antigravity/Cursor) so it helps instead of wandering

1. **Start every session by pasting AGENTS.md** (or pointing the agent at it) and saying:
   "You must not invent behaviour that is not in this file."
2. **One task per prompt.** "Build the Outcome screen per AGENTS.md section 'The four
   screens', using the Outcome JSON shape" — not "build my part."
3. **Make it run the app.** After each task: `npm run dev`, click the thing, paste errors
   back. Never accept "should work."
4. **Reject scope creep.** If the agent adds a settings page, extra languages, login, or a
   database, delete it. AGENTS.md lists what is deliberately cut.
5. **Keep secrets out.** `.env.local` is gitignored. Never paste API keys into a prompt if
   the file can be referenced instead.
6. **Say "reply suggestions."** If the agent writes "chips" anywhere, rename it.

## IBM Bob — everyone's second tool (we have ~50 Bobcoins TOTAL — budget them)

Bob is IBM's coding agent. Judges require it as the primary development tool, so its
fingerprints must be on the IBM spine of this repo — genuinely. We give Bob small,
well-specified, IBM-shaped tasks and screenshot everything. We do NOT let Bob roam the
repo or run long agent loops — that burns all 50 coins in an afternoon.

**Bob task list (do these, nothing else):**

| Who | Bob task | Commit message |
|---|---|---|
| Tanis | Plan session over AGENTS.md + scaffold the Next.js app | `bob: add AGENTS.md contract and scaffold Setu app` |
| Satyeta | `lib/watsonx/` client + the Llama reply-suggestion prompt | `bob: watsonx client + suggestion prompt` |
| Satyeta | `lib/watson-stt/` backup client + auto-switch | `bob: watson stt fallback` |
| Arya | Outcome screen first pass (then polish in Antigravity) | `bob: outcome card screen` |
| Tanis | Final review pass over the whole repo at the end | `bob: review` |

**Bob session rules:**
- One named task per session. When it's done, close the session. No "one more thing."
- Before closing: screenshot the conversation + diff → save into `docs/bob-log/` with a
  name like `03-satyeta-watsonx-client.png`.
- Commit Bob's work with the `bob:` prefix so the git history shows Bob's real contribution.
- If Bob's output is wrong, fix it in your own agent with a normal commit — don't burn
  coins arguing with Bob.
- Never claim Bob built something that has no session in `docs/bob-log/`.

## Keys each person needs

- **Everyone:** the shared `.env.local` from Tanis (sent privately, never committed).
- **Satyeta additionally:** ElevenLabs dashboard access (Starter plan), watsonx.ai project
  (Lite), Watson STT Lite instance on IBM Cloud.

## The one-line product test (run before every merge to main)

Type a clerk line (or speak it) → caption appears → suggestions appear → tap one → Send →
voice speaks → say "complaint number COMP-4821" → pin banner appears → confirm → end call →
outcome card shows COMP-4821 on top. If any link in that chain breaks, fix before merging.
