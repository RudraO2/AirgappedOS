# Faraday Web — the deployable link

> **This link is a simulation.** A Windows-style workstation in your browser, with Faraday running
> inside it on **hosted open-weight models (GPT-OSS-20B, Qwen3.8-27B) through the Groq API**, Gemma 4 on the
> Gemini API as fallback — the only way a public link can answer. **The real product is air-gapped**: open-weight models on the operator's own
> GPU, nothing leaves the machine. The router, the seal's refusals and record, and the signed `.docx`
> are the same code; only the fleet and the machine are simulated.
>
> **Run the real one locally:** https://github.com/RudraO2/Faraday — Windows 10/11 64-bit,
> NVIDIA GPU with 4 GB VRAM (built on a GTX 1650 Max-Q, Vulkan, no CUDA), 16 GB RAM, ~4 GB disk for
> the two Apache-2.0 Qwen models, Node 22.15+, pnpm 10.11+. Clone, double-click `run.bat`.

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
every prompt goes to the Groq API (or the Gemini API as fallback) — and the header pill, the drawer and the `.docx` audit
section all say so.

## Run it

```sh
cp .env.example .env      # paste GROQ_API_KEY (and GEMINI_API_KEY for the fallback)
npm install
npm run dev               # http://localhost:5173 — api/turn.ts is served by a dev middleware
npm test                  # the prototype's router, scorer, audit-trail and docx tests, ported
```

Deploy: Vercel, from `main`. Set `GROQ_API_KEY` and `GEMINI_API_KEY` (and optionally the `FARADAY_*` names in
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
