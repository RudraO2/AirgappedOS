/**
 * The model plane's only server piece: one function that holds the keys and
 * streams a turn back as NDJSON. Stateless — the browser sends the whole
 * conversation every time and runs the tool loop itself, because the simulated
 * workstation the tools act on lives in the browser.
 *
 * Primary plane: Anthropic (Haiku 4.5 for vision/document, Sonnet 5 for coder).
 * Fallback plane: Groq (`_groq.ts`), used only when Anthropic fails before it
 * has produced anything, and announced to the browser with a `fallback` piece.
 *
 * Wire format, one JSON object per line:
 *   { type: "text", text }            a text delta
 *   { type: "thinking", text }        a summarised-thinking delta
 *   { type: "fallback", provider, model, reason }   the fallback plane took the turn
 *   { type: "done", stop_reason, content, usage, model, provider }   raw assistant blocks, echoed back verbatim next turn
 *   { type: "error", message }
 */
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS } from "../src/faraday/tools/definitions.js";
import { streamGroq, GROQ_MODELS } from "./_groq";
import { systemPromptFor } from "./_prompts";

const MEMBERS = {
	vision: () => process.env.FARADAY_MODEL_VISION ?? "claude-haiku-4-5-20251001",
	coder: () => process.env.FARADAY_MODEL_CODER ?? "claude-sonnet-5",
} as const;

type Member = keyof typeof MEMBERS;

function hasImage(messages: Anthropic.MessageParam[]): boolean {
	return messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "image"));
}

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== "POST") {
		return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { "content-type": "application/json" } });
	}
	const haveAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
	const haveGroq = Boolean(process.env.GROQ_API_KEY);
	if (!haveAnthropic && !haveGroq) {
		return new Response(JSON.stringify({ error: "No model plane is configured: set ANTHROPIC_API_KEY (and optionally GROQ_API_KEY) on the server" }), { status: 500, headers: { "content-type": "application/json" } });
	}

	let body: { member?: Member; messages?: Anthropic.MessageParam[]; maxTokens?: number; provider?: "anthropic" | "groq" };
	try {
		body = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: "body must be JSON" }), { status: 400, headers: { "content-type": "application/json" } });
	}
	const member: Member = body.member === "vision" ? "vision" : "coder";
	const model = MEMBERS[member]();
	const messages = Array.isArray(body.messages) ? body.messages : [];
	const system = systemPromptFor(member);
	const forceGroq = body.provider === "groq";

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let sentAny = false;
			const send = (obj: unknown) => {
				sentAny = sentAny || (obj as { type?: string }).type === "text" || (obj as { type?: string }).type === "thinking";
				controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
			};
			const viaGroq = async (reason: string) => {
				send({ type: "fallback", provider: "groq", model: GROQ_MODELS[member](), reason });
				const result = await streamGroq(member, system, messages, send, { allowImages: false });
				send({ type: "done", stop_reason: result.stop_reason, content: result.content, model: result.model, provider: "groq" });
			};
			try {
				if (forceGroq || !haveAnthropic) {
					if (!haveGroq) throw new Error("GROQ_API_KEY is not set on the server");
					await viaGroq(forceGroq ? "requested" : "ANTHROPIC_API_KEY is not set");
					return;
				}
				const client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
				const params: Anthropic.MessageStreamParams = {
					model,
					max_tokens: body.maxTokens ?? 4096,
					system,
					messages,
					tools: TOOL_DEFINITIONS as unknown as Anthropic.Tool[],
				};
				if (member === "coder") {
					// Sonnet 5: adaptive thinking; a fixed budget is rejected. Effort keeps it short.
					(params as Record<string, unknown>).thinking = { type: "adaptive", display: "summarized" };
					(params as Record<string, unknown>).output_config = { effort: process.env.FARADAY_CODER_EFFORT ?? "low" };
				}
				try {
					const run = client.messages.stream(params);
					for await (const event of run) {
						if (event.type === "content_block_delta") {
							const delta = event.delta as { type: string; text?: string; thinking?: string };
							if (delta.type === "text_delta" && delta.text) send({ type: "text", text: delta.text });
							else if (delta.type === "thinking_delta" && delta.thinking) send({ type: "thinking", text: delta.thinking });
						}
					}
					const final = await run.finalMessage();
					send({ type: "done", stop_reason: final.stop_reason, content: final.content, usage: final.usage, model: final.model, provider: "anthropic" });
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					// Fall back only if nothing reached the browser yet, so no text is duplicated.
					if (haveGroq && !sentAny) {
						await viaGroq(message.length > 140 ? message.slice(0, 140) + "…" : message);
					} else {
						throw error;
					}
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				send({ type: "error", message });
			} finally {
				controller.close();
			}
		},
	});

	// A caller asking whether images can go to the fallback: not on this key.
	void hasImage;

	return new Response(stream, {
		headers: {
			"content-type": "application/x-ndjson; charset=utf-8",
			"cache-control": "no-cache, no-transform",
			"x-accel-buffering": "no",
		},
	});
}
