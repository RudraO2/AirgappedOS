/**
 * The model plane's only server piece: one function that holds the Anthropic
 * key and streams a turn back as NDJSON. Stateless — the browser sends the whole
 * conversation every time and runs the tool loop itself, because the simulated
 * workstation the tools act on lives in the browser.
 *
 * Wire format, one JSON object per line:
 *   { type: "text", text }            a text delta
 *   { type: "thinking", text }        a summarised-thinking delta (coder lane only)
 *   { type: "done", stop_reason, content, usage }   raw assistant blocks, echoed back verbatim next turn
 *   { type: "error", message }
 */
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS } from "../src/faraday/tools/definitions.js";
import { systemPromptFor } from "./_prompts";

const MEMBERS = {
	vision: () => process.env.FARADAY_MODEL_VISION ?? "claude-haiku-4-5-20251001",
	coder: () => process.env.FARADAY_MODEL_CODER ?? "claude-sonnet-5",
} as const;

type Member = keyof typeof MEMBERS;

export default async function handler(req: Request): Promise<Response> {
	if (req.method !== "POST") {
		return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { "content-type": "application/json" } });
	}
	if (!process.env.ANTHROPIC_API_KEY) {
		return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server" }), { status: 500, headers: { "content-type": "application/json" } });
	}

	let body: { member?: Member; messages?: Anthropic.MessageParam[]; maxTokens?: number };
	try {
		body = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: "body must be JSON" }), { status: 400, headers: { "content-type": "application/json" } });
	}
	const member: Member = body.member === "vision" ? "vision" : "coder";
	const model = MEMBERS[member]();
	const messages = Array.isArray(body.messages) ? body.messages : [];
	const client = new Anthropic();

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
			try {
				const params: Anthropic.MessageStreamParams = {
					model,
					max_tokens: body.maxTokens ?? 4096,
					// The persona lives here, per member, never in the browser.
					system: systemPromptFor(member),
					messages,
					tools: TOOL_DEFINITIONS as unknown as Anthropic.Tool[],
				};
				if (member === "coder") {
					// Sonnet 5: adaptive thinking; a fixed budget is rejected. Effort keeps it short.
					(params as any).thinking = { type: "adaptive", display: "summarized" };
					(params as any).output_config = { effort: process.env.FARADAY_CODER_EFFORT ?? "low" };
				}
				const run = client.messages.stream(params);
				for await (const event of run) {
					if (event.type === "content_block_delta") {
						const delta = event.delta as { type: string; text?: string; thinking?: string };
						if (delta.type === "text_delta" && delta.text) send({ type: "text", text: delta.text });
						else if (delta.type === "thinking_delta" && delta.thinking) send({ type: "thinking", text: delta.thinking });
					}
				}
				const final = await run.finalMessage();
				send({ type: "done", stop_reason: final.stop_reason, content: final.content, usage: final.usage, model: final.model });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				send({ type: "error", message });
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"content-type": "application/x-ndjson; charset=utf-8",
			"cache-control": "no-cache, no-transform",
			"x-accel-buffering": "no",
		},
	});
}
