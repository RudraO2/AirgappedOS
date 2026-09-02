# Faraday Web — the deployable link

> **What you are looking at.** This link runs Faraday inside a simulated Windows-style workstation
> in your browser. The models behind it are **Claude Haiku 4.5 and Claude Sonnet 5, reached through
> Anthropic's API** — closed-weight, hosted — because that is the only way a public link can answer at
> all. The real product runs **open-weight models on the operator's own GPU, fully offline**; the
> recorded local run is that proof. Everything else here is the same code path: the router really
> classifies and scores, the seal really refuses the workbench's outbound tool calls before they run
> and records each one, and the approval note is a real `.docx`. What is simulated is the fleet and
> the machine — and this notice says so up front.

Smart India Hackathon 2026 · **SIH26117** · Mangalore Refinery and Petrochemicals Limited.
The Phase 0 prototype (a DeepSeek Harness plugin running local models) is in `reference/`, untouched.

## What is here

- **A simulated workstation** in React: window manager, taskbar, start menu, a virtual filesystem,
  File Explorer, Notepad, a PowerShell-shaped Terminal (with `node -e` really evaluated in a Web
  Worker), a Browser whose tabs are real iframes, Settings with light and dark themes.
- **Faraday, as an app in it**: the seal row, the Sovereignty drawer with the egress record, the
  routing chip that shows its working, attached images to the vision member, the coder lane with
  summarised extended thinking, and the deliverable factory writing a signed `.docx`.
- **Tool calls that land on screen**: `pwsh` types into the Terminal, `browser_open` opens a tab,
  `read_file` / `write_file` / `list_dir` act on the workstation, `bf_approval_note` writes to
  `Documents\Deliverables` and offers the download.

## The seal, in this build

The seal governs what Faraday's tools may reach from the workstation. With it closed, an outbound
tool call is refused before it runs, counted, and recorded; with it open, the same call really
leaves the page (watch your own DevTools Network tab). It does **not** govern the model plane —
every prompt goes to Anthropic's API — and the header pill, the drawer and the `.docx` audit
section all say so.

## Run it

```sh
cp .env.example .env      # paste ANTHROPIC_API_KEY
npm install
npm run dev               # http://localhost:5173 — api/turn.ts is served by a dev middleware
npm test                  # the prototype's router, scorer, audit-trail and docx tests, ported
```

Deploy: Vercel, from `main`. Set `ANTHROPIC_API_KEY` (and optionally the `FARADAY_*` names in
`.env.example`) under the project's environment variables. `api/turn.ts` is the only server piece
and the key never reaches the browser bundle.

## Ported from the prototype, unchanged

`src/faraday/lib/router/` (classify, score, dispatch), `lib/egress/policy.js` (the denial patterns
and reason strings, extracted verbatim), `lib/deliverables/audit-trail.js`, `lib/deliverables/docx.js`
(zip container now via `fflate`), `lib/model-plane/injected.js`, `lib/trace/turn.js`, and their tests.

## Cut, said out loud

Fan-out gauge, residency (nothing is resident on a hosted fleet), the licence gate (closed models),
the replay provider, GenUI fences, Python execution (no sandbox on a web page), session persistence
across reloads. OCR and provenance crops were already cut by the prototype's ADR-0008.
