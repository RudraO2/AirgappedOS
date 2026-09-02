# Faraday Web — SIH PART 2

The deployable-link build of **Faraday** (SIH26117, "Blind Flange"). One sentence: the
Phase 0 prototype only runs as a local Node process on the operator's own machine, and the
internal hackathon round demands a URL a judge can open. This repository is that URL.

**Read this file first in any new session.** It is the standing brief. `reference/` is the
original prototype, copied here verbatim on 3 September 2026 and never edited.

---

## The situation

The Phase 0 prototype is **Faraday** — a sovereign, air-gapped agentic AI workbench for MRPL
built on open-weight local models. It lives at
`C:\Users\rpxi1\OneDrive\Documents\Desktop\SIH` (GitHub: `RudraO2/blind-flange`, private).
It is genuinely offline: llama-swap holding Qwen3-4B and Qwen3-VL-2B on a GTX 1650, a seal
that denies outbound calls, a router that classifies, a deliverable factory that writes
`.docx`.

**None of that can be deployed to a link**, because the whole product *is* the local machine.
Weights, GPU, sandbox, filesystem, a seal whose entire meaning is that the box is air-gapped.

The internal hackathon round from the college side treats a live deployed link as mandatory.
So this repository builds the thing that can be opened in a browser: a **simulated desktop OS
in React, with Faraday running inside it as an application**, backed by hosted API models
instead of local weights.

## What we are building

A single React web app, deployed to a public URL, containing:

1. **A simulated OS** — a Windows-like desktop in React. Window manager, taskbar, start
   menu, file system (virtual), a working in-OS browser, a terminal. The OS is the stage;
   it exists so Faraday has somewhere to *be an application*, and so its tool calls have
   somewhere to land visibly.
2. **Faraday, as an app inside that OS** — the workbench itself, running in a window like
   any other program. It keeps the prototype's identity: the seal, the routing chip, the
   fleet, the lanes, the deliverable factory, the audit record.
3. **Tool calling across the whole OS** — Faraday can act on the simulated machine: run
   PowerShell-shaped commands in the simulated terminal, open a URL in the in-OS browser,
   read and write simulated files, and produce real `.docx` output the user can download.
   The tool call is visible on screen: the judge watches the OS react.

## Model plane for the web build

The prototype's `ModelProvider` interface stays. What changes is what sits behind it.
**Decided 3 September 2026: Anthropic API only.** No open-weight, no OpenRouter, no Grok —
those were considered and dropped. One key, two models, and the routing between them is the
demo.

| Fleet member | Model | Routes when | Thinking |
|---|---|---|---|
| **Vision / document** | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | the message carries an **attached image** | none (Haiku has no extended-thinking mode) |
| **Coder / calculation** | **Claude Sonnet 5** (`claude-sonnet-5`) | the request is a **coding or calculation** task | extended thinking, **low budget** — enough to be visible, not enough to stall the demo |

**Routing is simulated, and that word is used precisely.** The router really classifies the
request and really picks a member — that logic ports from
`reference/plugins/dsh-client-ui-base/lib/router/`. What is simulated is the *fleet*: the
prototype routed between two open-weight models on one GPU, and this build routes between
two Anthropic models over an API. The routing chip must still show its working — task type,
score per member, who was filtered out and why — because that surface is one of the three
demo moments.

Keys live in `.env` (`.env.example` names every variable). Never committed.

## Correction to the original assumption — read this

**Faraday is not a React application, and there is no React frontend to copy.**

`reference/plugins/dsh-client-ui-base/` is an out-of-tree plugin for **DeepSeek Harness**
(`@deepseek-ai/dsh@0.1.1-rc.2`, MIT). The React comes from the *host* — `client.js` is
written in the host loader's module format and `require`s `react/jsx-runtime` and the
`@deepseek-ai/dsh-client-*` packages at load time. It ships no React and needs no bundler.
The UI is assembled by registering components into the harness's declared slots
(`sidebar.footer.action`, `conversation.input.model`, and so on).

Practical consequence for this build:

- **The UI layer must be rebuilt** as real React. ~3,155 lines in `client.js` are slot
  registrations against an API that will not exist here. Read it for *behaviour and copy*,
  reimplement the rendering.
- **The logic layer ports nearly as-is.** `router/` (classify, score, dispatch), `egress/seal.js`,
  `deliverables/` (docx, zip, audit-trail), `lanes/`, `registry/loader.js`, `trace/`,
  `model-plane/` — plain ES modules with `node --test` tests beside them. This is the part
  worth carrying over intact, tests included.
- **The seal changes meaning and must be re-argued.** In the browser there is no process
  boundary to deny at. Decide honestly how the seal is presented in a simulated OS before
  building it — a simulated denial that looks identical to a real one is the one thing that
  would genuinely embarrass us in front of the panel.

## Repository layout

```
SIH PART 2/
├── CLAUDE.md          this file — the standing brief
├── .env.example       every variable the app needs, named. Copy to `.env`.
├── reference/         the Phase 0 prototype, copied verbatim 3 Sep 2026. READ ONLY.
│   ├── plugins/dsh-client-ui-base/   Faraday itself (harness plugin, not React)
│   ├── docs/                          ADRs, screenshots (light+dark), measurements
│   ├── CONTEXT.md                     the project vocabulary — still authoritative
│   ├── CLAUDE.reference.md            the old repo's instructions (renamed so it does
│   │                                  not auto-load; its BMAD/licence rules are NOT
│   │                                  this repository's rules)
│   └── _bmad-output/                  the original plan: 7 epics, 33 stories
└── (the new app — not yet created)
```

**Never edit anything under `reference/`.** It is the source of truth for what the prototype
did and how it looked. Copy out of it; do not change it. The original folder at
`Desktop\SIH` is likewise untouched.

## Rules for this repository

- **`reference/CONTEXT.md` is still the shared language.** Seal, fleet, router, routing chip,
  the cut line, deliverable factory, sovereignty drawer. Use those words in code, UI copy and
  commits. Don't drift to the synonyms it lists under `_Avoid_`.
- **`reference/docs/screenshots/`** is the visual target. Every surface renders in light *and*
  dark; a panel that only works in one is unfinished. That rule carries over.
- **The licence policy does not bind this repository the way it bound the prototype.** We are
  deliberately using closed-source hosted models here — that is the whole point of this build.
  Do not run `licence-audit` against this repo or treat AGPL-avoidance as a blocker. The
  original policy still governs the real product; this is the demo shell.
- **BMAD is not the method here.** `reference/_bmad-output/` is history and useful context,
  not a process to re-enter.
- **Secrets live in `.env`, never committed.** Ask the user for keys; write a `.env.example`
  with every variable named.
- **Push to `main` after every working change.** Repo: **https://github.com/RudraO2/AirgappedOS**.
  Use the GitHub MCP server. Speed matters more than commit hygiene on this deadline —
  commit often, push every time.
- Commit messages in normal English, Conventional Commits subject.

## Building from the running prototype — Chrome DevTools MCP

The rebuild does not have to work from static screenshots alone. **The original prototype
still runs**, and the `chrome-devtools` MCP server is attached, so a session can drive it
directly:

```sh
cd reference && npm start        # serves http://127.0.0.1:3080
```

Then `new_page` / `navigate_page` to `127.0.0.1:3080` and use `take_screenshot`,
`take_snapshot`, `click`, `fill`, `evaluate_script` to open each surface — the seal row, the
Sovereignty drawer, the routing chip expanded, the fan-out gauge, the deliverable factory —
in both themes, and capture what it actually looks like and how it actually behaves. That is
a far better source than `docs/screenshots/`, which is 40 stills and no interaction.

Two cautions: `npm start` will install the pinned harness and the one adopted plugin over the
network if they are missing, and the model plane needs either a local llama-swap or
`modelPlane.provider: replay` in the profile patch. **Replay is the right mode for
screenshotting** — every panel works, nothing needs a GPU.

## Open questions — ask the user, don't guess

1. **Deploy target.** Vercel is the obvious fit for a React SPA and its MCP server is
   attached. Confirm before assuming. Note the Anthropic key must stay server-side — a
   serverless function or edge route, never in the browser bundle.
2. **How much of the prototype's surface must survive** in the OS window, versus what is cut.
   The original had 7 epics and 33 stories. Decide the demo path first, then build to it.
3. **How the seal is presented** once there is no process boundary to deny at (see the
   correction section above).

## Status

- 3 Sep 2026 — prototype copied to `reference/`. `.env.example` and `.gitignore` written.
  Model plane decided: Anthropic only, Haiku for vision, Sonnet for code, thinking low.
  Repo created: `RudraO2/AirgappedOS`. **No code written, no plan committed to** — the next
  session plans first.
