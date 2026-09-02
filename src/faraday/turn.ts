/**
 * One turn of the workbench: classify, score the fleet, stream the model,
 * run whatever tools it calls on the workstation, and loop until it stops.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { classifyRequest } from "./lib/router/classify.js";
import { recordRoutingDecision } from "./lib/router/dispatch.js";
import { scoreFleet } from "./lib/router/score.js";
import { FLEET, memberFor } from "./lib/registry/fleet.js";
import { clearTurn, recordImages } from "./lib/trace/turn.js";
import { os } from "../os/kernel/store";
import { executeTool } from "./tools/execute";
import { nextTurnId, useFaraday, type Block, type RoutingDecision, type Turn } from "./store";

type Piece =
	| { type: "text"; text: string }
	| { type: "thinking"; text: string }
	| { type: "fallback"; provider: string; model: string; reason: string }
	| { type: "done"; stop_reason: string; content: Anthropic.ContentBlock[]; usage?: unknown; model?: string }
	| { type: "error"; message: string };

async function* streamTurn(body: unknown): AsyncGenerator<Piece> {
	const response = await fetch("/api/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
	if (!response.ok || !response.body) {
		let message = `${response.status} ${response.statusText}`;
		try {
			const j = await response.json();
			if (j?.error) message = String(j.error);
		} catch {
			/* not json */
		}
		yield { type: "error", message };
		return;
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let nl: number;
		while ((nl = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, nl).trim();
			buffer = buffer.slice(nl + 1);
			if (line) yield JSON.parse(line) as Piece;
		}
	}
	if (buffer.trim()) yield JSON.parse(buffer) as Piece;
}

export async function runTurn(text: string, image?: { base64: string; mediaType: string; url: string }) {
	const store = useFaraday.getState();
	if (store.busy) return;
	const session = store.current();
	const sessionId = session.id;
	const patch = (fn: (s: typeof session) => Partial<typeof session>) => useFaraday.getState().updateSession(sessionId, fn);
	const setTurn = (id: number, fn: (t: Turn) => Turn) => patch((s) => ({ turns: s.turns.map((t) => (t.id === id ? fn(t) : t)) }));

	store.setBusy(true);
	store.setPendingImage(null);
	clearTurn();
	recordImages(image ? 1 : 0);

	// 1. The operator's message, on screen and on the wire.
	const userTurn: Turn = { id: nextTurnId(), role: "user", text, image: image ? { url: image.url, mediaType: image.mediaType } : undefined };
	const userContent: Anthropic.ContentBlockParam[] = [];
	if (image) userContent.push({ type: "image", source: { type: "base64", media_type: image.mediaType as "image/png", data: image.base64 } });
	userContent.push({ type: "text", text });
	patch((s) => ({
		turns: [...s.turns, userTurn],
		api: [...s.api, { role: "user", content: userContent }],
		title: s.turns.length === 0 ? text.slice(0, 48) : s.title,
	}));

	// 2. Route. Classification and scoring are both recorded, then the decision
	//    reaches the model call through the same memo the prototype used.
	const classification = classifyRequest(text, { hasImage: Boolean(image) });
	useFaraday.getState().appendEvent("router/classified", { turn: session.turns.length + 1, step: 1, ...classification, noRequestText: text === "" });
	const routing = scoreFleet(classification.taskType, FLEET) as RoutingDecision;
	useFaraday.getState().appendEvent("router/routed", { turn: session.turns.length + 1, step: 1, ...routing });
	recordRoutingDecision(routing, session.turns.length + 1);
	patch(() => ({ routing }));
	const member = memberFor(routing.selected ?? "");

	// 3. The model, and its tools, until it stops.
	const assistantId = nextTurnId();
	patch((s) => ({ turns: [...s.turns, { id: assistantId, role: "assistant", blocks: [], member: routing.selected ?? undefined, done: false }] }));
	const pushBlock = (block: Block) => setTurn(assistantId, (t) => (t.role === "assistant" ? { ...t, blocks: [...t.blocks, block] } : t));
	const appendToLast = (type: "text" | "thinking", delta: string) =>
		setTurn(assistantId, (t) => {
			if (t.role !== "assistant") return t;
			const last = t.blocks[t.blocks.length - 1];
			if (last && last.type === type) return { ...t, blocks: [...t.blocks.slice(0, -1), { ...last, text: last.text + delta }] };
			return { ...t, blocks: [...t.blocks, { type, text: delta } as Block] };
		});
	const setToolBlock = (id: string, fn: (b: Extract<Block, { type: "tool" }>) => Extract<Block, { type: "tool" }>) =>
		setTurn(assistantId, (t) => (t.role === "assistant" ? { ...t, blocks: t.blocks.map((b) => (b.type === "tool" && b.id === id ? fn(b) : b)) } : t));

	try {
		for (let step = 0; step < 8; step += 1) {
			const api = useFaraday.getState().current().api;
			let final: Extract<Piece, { type: "done" }> | null = null;
			// Dev hook: window.__forceProvider = "groq" exercises the fallback plane on purpose.
			const provider = (window as unknown as { __forceProvider?: string }).__forceProvider;
			for await (const piece of streamTurn({ member, messages: api, provider })) {
				if (piece.type === "text") appendToLast("text", piece.text);
				else if (piece.type === "thinking") appendToLast("thinking", piece.text);
				else if (piece.type === "fallback") {
					setTurn(assistantId, (t) => (t.role === "assistant" ? { ...t, via: { provider: piece.provider, model: piece.model, reason: piece.reason } } : t));
					os.toast({ title: "Model plane fell back.", body: `Anthropic did not answer (${piece.reason}). ${piece.model} via Groq is answering this turn.`, tone: "warning" });
				} else if (piece.type === "error") throw new Error(piece.message);
				else if (piece.type === "done") final = piece;
			}
			if (!final) throw new Error("the model plane closed the stream without finishing the turn");
			// The raw assistant blocks go back verbatim — thinking blocks included.
			patch((s) => ({ api: [...s.api, { role: "assistant", content: final!.content as Anthropic.ContentBlockParam[] }] }));
			const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
			if (final.stop_reason !== "tool_use" || toolUses.length === 0) break;

			const results: Anthropic.ToolResultBlockParam[] = [];
			for (const call of toolUses) {
				const input = (call.input ?? {}) as Record<string, unknown>;
				pushBlock({ type: "tool", id: call.id, name: call.name, input, status: "running" });
				const outcome = await executeTool(call.name, input, { images: image ? 1 : 0 });
				setToolBlock(call.id, (b) => ({ ...b, status: outcome.status, result: outcome.content, produced: outcome.produced }));
				results.push({ type: "tool_result", tool_use_id: call.id, content: outcome.content, is_error: outcome.isError });
			}
			patch((s) => ({ api: [...s.api, { role: "user", content: results }] }));
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setTurn(assistantId, (t) => (t.role === "assistant" ? { ...t, error: message } : t));
	} finally {
		setTurn(assistantId, (t) => (t.role === "assistant" ? { ...t, done: true } : t));
		useFaraday.getState().setBusy(false);
	}
}
