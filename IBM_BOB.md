# How we used IBM Bob in Sampark

This is the IBM SkillBuild record of **IBM Bob** (IBM’s coding agent) in this repository. It is written against the **current** tree and the **git history**.

## Current stack (verified in code)

The live reply model is **not Llama**. It is **GPT-OSS-120B on Groq**.

| Job | What the repo actually runs |
|---|---|
| App | Next.js **15.3.3** (App Router), React 19, TypeScript, Tailwind, PWA (`public/manifest.json`) |
| Captions | ElevenLabs Scribe v2 Realtime (`scribe_v2_realtime`). If Scribe fails: **Captions off**; typed clerk line still works. No second STT vendor. |
| Speech out | ElevenLabs **`eleven_flash_v2_5`** only, via `POST /api/tts`. Browser `speechSynthesis` if that fails (**Demo voice**). `eleven_multilingual_v2` is not wired. |
| Reply + gloss LLM | **Groq `openai/gpt-oss-120b`**. Temperature 0.2, JSON object. `reasoning_effort: "low"` for gpt-oss. |
| LLM file | [`lib/watsonx/llama.ts`](lib/watsonx/llama.ts) — **filename is historical**. Default constant is `openai/gpt-oss-120b`. |
| Optional unused path | `LLM_PROVIDER=watsonx` still calls IBM watsonx.ai `meta-llama/llama-3-3-70b-instruct`. That is **not** the demo default. |
| ISL | CWASA SiGML player + sign files from [shoebham/text_to_isl](https://github.com/shoebham/text_to_isl). Unknown words fingerspell. Gloss: LLM then local catalog fallback. |
| UI languages | 8 files in `messages/`: en, hi, ta, te, kn, ml, mr, bn (`next-intl`) |
| Call languages | Hindi, English |
| Playbooks | 18 JSON files, six categories (emergency, utility, money, health, government, legal) |
| Phone | `ExotelTransport` stub. Demo audio is `RoomTransport`. |
| Host | Railway + `server.js` (WebSocket room). HTTP long-poll if WebSocket is down. |
| Routes | `/` landing, `/setup`, `/start`, `/call`, `/clerk`, `/outcome` |

Env default ([`.env.local.example`](.env.local.example)): `LLM_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-120b`. If someone still sets the retired Groq ids `llama-3.3-70b-versatile` or `llama-3.1-8b-instant`, the client remaps them to `openai/gpt-oss-120b` / `openai/gpt-oss-20b`.

**On the live call:** `POST /api/suggest` → `suggest()` (GPT-OSS). `POST /api/gloss` → `gloss()` (GPT-OSS, then local gloss if the LLM fails). `extractFacts()` exists in the file and is **not imported** by `app/`. Complaint numbers use [`lib/guard/refnum.ts`](lib/guard/refnum.ts).

---

**What is true about Bob**

- IBM Bob authored the first commit: the product contract and the Next.js scaffold (then named Setu).
- The live call still follows that contract: Send before speech, OTP/PIN/Aadhaar never spoken, outcome card on top, audio only through `AudioTransport`.
- Reply suggestions and ISL gloss still go through the module Bob stubbed (`lib/watsonx/llama.ts`). The **model inside it is now GPT-OSS-120B**, not Llama.
- [`docs/bob-log/`](docs/bob-log/) has a README and **no screenshots**. Durable evidence is git.

---

## What IBM Bob is here

IBM Bob is the IBM coding agent on this team, alongside Cursor and Antigravity. All of them are supposed to follow [`AGENTS.md`](AGENTS.md).

Bob was used for a **named first job**: write the contract and scaffold the app. The team filled the stubs. Later `feat:` / `fix:` commits are not extra IBM Bob–authored commits.

---

## What git actually shows

```bash
git log --format="%h %an <%ae> %s" --grep="bob:"
```

| Commit | Git author | Message | What it is |
|---|---|---|---|
| [`376fabf`](https://github.com/snk189/ibm_hack/commit/376fabf480e6cb4c31caeee4bffc97478bd63905) | **IBM Bob** `<bob@setu>` | `bob: add AGENTS.md contract and scaffold Setu app` | First commit. Contract + placeholder app. Named Llama on watsonx as the planned LLM. |
| [`0afc7f9`](https://github.com/snk189/ibm_hack/commit/0afc7f98fc5174595b7e8a905b5ff346be4a0329) | **Tanish M** `<tanish@sampark.dev>` | `bob: review and publish current Sampark working tree` | Human-authored publish of the then-current tree, tagged `bob:`. Not authored by the IBM Bob git user. |

There is **no** commit whose message is `bob: watsonx client + suggestion prompt`, `bob: watson stt fallback`, or `bob: outcome card screen`.

---

## 1. What Bob built (376fabf)

The author of this commit is IBM Bob. The app was then called **Setu**; it was later renamed **Sampark**.

Bob did **not** ship a working call loop. Bob shipped the **shape** the loop still uses:

| In that commit | Then | Now |
|---|---|---|
| [`AGENTS.md`](AGENTS.md) | Four hard rules, JSON shapes, API list. LLM row said Llama 3.3 70B on watsonx. | Still the contract for product rules. The **running** LLM is Groq GPT-OSS-120B. |
| Routes | `/` setup, `/start`, `/call`, `/outcome` — placeholder pages | `/` is a **landing** page. Setup is `/setup`. `/clerk` is the two-browser operator console. |
| Components | Named stubs: `CaptionFeed`, `ReplySuggestions`, `ISLAvatar`, `DTMFPad`, `OutcomeCard`, `SilenceRing`, `UnmuteButton` | Same names, now implemented. |
| `AudioTransport` | Interface + `RoomTransport` + `ExotelTransport` stub | Still the only audio path. Demo uses `RoomTransport`. Exotel is still a stub. |
| Guard files | OTP / reference-number / redaction stubs | Implemented. Live pin-banner uses `detectReferenceNumbers()`. |
| API files | `/api/suggest`, `/api/gloss`, `/api/tts`, `/api/scribe-token` | Wired. Plus `/api/room-relay` and `/api/jas/*`. |
| [`lib/watsonx/llama.ts`](lib/watsonx/llama.ts) | `suggest()`, `extractFacts()`, `gloss()` **throwing** `not implemented`; comments said watsonx Llama | Implemented. Default model **`openai/gpt-oss-120b`**. |
| `playbooks/power-cut.json` | The playbook JSON shape | Same shape; 18 playbooks. |
| `lib/watson-stt/` and `/api/stt-fallback` | Watson Speech-to-Text backup stubs | **Removed.** Scribe only. |
| `docs/bob-log/` | Folder + README | README only. No session PNGs. |

Placeholder copy in Bob’s pages said “TODO: step 2 — clickable skeleton.” The clickable UI, clerk console, Railway host, GPT-OSS client, and 8 UI languages came later.

---

## 2. LLM module — Bob stubbed it; the live model is GPT-OSS

Bob fixed three function names. That file is still the LLM boundary. The **hosted/demo model is Groq GPT-OSS-120B**, because Groq retired `llama-3.3-70b-versatile` for free/developer keys (2026-08-16).

**On the live call today** ([`app/call/page.tsx`](app/call/page.tsx)):

| Call | Function | Model |
|---|---|---|
| `POST /api/suggest` | `suggest()` | Groq `openai/gpt-oss-120b` → 3–5 suggestions. `label` in UI language, `sentence` in Hindi or English. |
| `POST /api/gloss` | `gloss()` | Same GPT-OSS call, then catalog-aligned. If the LLM fails: local `captionToGloss()`. |

**Not on the live call today**

- `extractFacts()` is not imported from `app/`. Clerk complaint numbers are detected by `detectReferenceNumbers`.

**Who wrote the working client**

| Change | Commit | Author | Prefix |
|---|---|---|---|
| Stubs (planned watsonx Llama) | `376fabf` | IBM Bob | `bob:` |
| Working watsonx HTTP + suggestion prompt. Comment `// bob: watsonx client + suggestion prompt` | [`bb2e4d6`](https://github.com/snk189/ibm_hack/commit/bb2e4d6) | Tanis | `feat:` |
| Groq provider + later default **`openai/gpt-oss-120b`** | [`899ea37`](https://github.com/snk189/ibm_hack/commit/899ea37) and later | Tanis / team | `feat:` |

The inline `bob:` comment names the **planned Bob task** for that module. Git does **not** show IBM Bob as author of the HTTP client, and it does **not** show Llama as the model we run.

If no `GROQ_API_KEY` is set, `suggest()` returns `[]`. The live screen still shows the four **always-present** suggestions from [`lib/suggestions/skeleton.ts`](lib/suggestions/skeleton.ts) (Wait / Please repeat / I did not understand / Please give the complaint number).

---

## 3. The `bob:` review commit (0afc7f9)

Git author is **Tanish M**, not IBM Bob. The message is `bob: review and publish current Sampark working tree`.

Treat it as the planned final review/publish, committed by the integration lead — not as “IBM Bob wrote the clerk console” and not as “the app runs Llama.”

---

## IBM Bob the agent vs IBM APIs vs the model we run

| Piece | Role now |
|---|---|
| **IBM Bob** | Coding agent. Git author of the contract + scaffold (`376fabf`). |
| **Groq GPT-OSS-120B** | **The LLM we use** for suggestions and gloss. |
| **IBM watsonx.ai Llama 3.3 70B** | Optional code path if `LLM_PROVIDER=watsonx`. Not the default. Not what the demo is set to. |
| **IBM Cloud IAM** | Only if that watsonx path is selected. |

---

## What we do not claim

- We do not run Llama 3.3 70B for the demo. We run **`openai/gpt-oss-120b`** on Groq.
- The file name `llama.ts` is leftover from Bob’s scaffold. It is not the model id.
- Bob did not implement ElevenLabs Scribe or `eleven_flash_v2_5` TTS.
- Bob did not implement `/clerk` or the WebSocket room.
- Bob did not ship 8 UI languages or the landing page.
- Bob did not leave PNG session captures in `docs/bob-log/`.
- Bob did not put Watson Speech-to-Text on the current caption path (that stub was removed).
- Bob did not wire `extractFacts()` into the live call.
- A `bob:` commit message with a human git author is not an IBM Bob–authored commit.

---

## How to verify (judges)

1. `git show 376fabf --stat` — author `IBM Bob <bob@setu>`.
2. [`.env.local.example`](.env.local.example) and `DEFAULT_GROQ_MODEL` in [`lib/watsonx/llama.ts`](lib/watsonx/llama.ts) — both `openai/gpt-oss-120b`.
3. [`app/api/tts/route.ts`](app/api/tts/route.ts) — `MODEL_ID = "eleven_flash_v2_5"`. [`lib/elevenlabs/scribe.ts`](lib/elevenlabs/scribe.ts) — `scribe_v2_realtime`.
4. Grep `extractFacts` — defined in `llama.ts`, not called from `app/`.
5. On `/call`, type a clerk line → `/api/suggest` and `/api/gloss`. Always-present suggestions remain if the Groq key is missing.
