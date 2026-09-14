# Sampark

Sampark is a web app that acts as the ears and mouth of a deaf or non-verbal person on an official phone call (electricity board, bank, hospital, cyber helpline 1930). The clerk uses a normal phone and installs nothing.

See [`AGENTS.md`](AGENTS.md) for the full product contract and [`TEAM_GUIDE.md`](TEAM_GUIDE.md) for team responsibilities.

## Getting started

```bash
cp .env.local.example .env.local  # fill in your API keys
npm install
npm run dev      # Next.js app (demo call loop works without keys)
npm run dev:ws   # optional Watson STT WebSocket proxy in server.js
```

## Environment variables

See `.env.local` (shared privately by Tanis — never commit it):

```
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID_HI=
ELEVENLABS_VOICE_ID_EN=
LLM_PROVIDER=groq
GROQ_API_KEY=                 # console.groq.com — Llama 3.3 70B, free tier
GROQ_MODEL=llama-3.3-70b-versatile
# Optional: watsonx if you have IBM keys (LLM_PROVIDER=watsonx)
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
WATSON_STT_API_KEY=
WATSON_STT_URL=
```

## Credits

- ISL avatar uses the **CWASA SiGML player** and Indian Sign Language sign files vendored from [github.com/shoebham/text_to_isl](https://github.com/shoebham/text_to_isl).
