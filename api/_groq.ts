/**
 * The fallback model plane: Groq's OpenAI-compatible endpoint. Used only when
 * Anthropic fails before it has produced anything. Speaks the same NDJSON as
 * the primary path and hands back Anthropic-shaped content blocks, so the
 * browser's tool loop does not know which plane answered — the transcript says.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS } from "../src/faraday/tools/definitions.js";

export const GROQ_MODELS = {
	coder: () => process.env.FARADAY_FALLBACK_CODER ?? "openai/gpt-oss-20b",
	vision: () => process.env.FARADAY_FALLBACK_VISION ?? "qwen/qwen3.8-27b",
} as const;

type Member = keyof typeof GROQ_MODELS;

interface OpenAIMessage {
	role: "system" | "user" | "assistant" | "tool";
	content?: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
	tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
	tool_call_id?: string;
}

/** Anthropic messages → OpenAI messages. Thinking blocks are dropped; images become data URLs (or a note when the model cannot see). */
function toOpenAI(system: string, messages: Anthropic.MessageParam[], allowImages: boolean): OpenAIMessage[] {
	const out: OpenAIMessage[] = [{ role: "system", content: system }];
	for (const m of messages) {
		if (typeof m.content === "string") {
			out.push({ role: m.role, content: m.content });
			continue;
		}
		if (m.role === "user") {
			const results = m.content.filter((b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result");
			if (results.length > 0) {
				for (const r of results) {
					const text = typeof r.content === "string" ? r.content : (r.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
					out.push({ role: "tool", tool_call_id: r.tool_use_id, content: text });
				}
				continue;
			}
			const parts: NonNullable<Exclude<OpenAIMessage["content"], string>> = [];
			let dropped = 0;
			for (const b of m.content) {
				if (b.type === "text") parts.push({ type: "text", text: b.text });
				else if (b.type === "image" && b.source.type === "base64") {
					if (allowImages) parts.push({ type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });
					else dropped += 1;
				}
			}
			if (dropped > 0) parts.unshift({ type: "text", text: `[${dropped} attached image${dropped === 1 ? "" : "s"} could not be forwarded to the fallback model, which cannot see. Say so rather than describing it.]` });
			out.push({ role: "user", content: parts });
			continue;
		}
		// assistant
		const text = m.content.filter((b): b is Anthropic.TextBlockParam => b.type === "text").map((b) => b.text).join("\n");
		const calls = m.content
			.filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use")
			.map((b) => ({ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
		const msg: OpenAIMessage = { role: "assistant", content: text || (calls.length ? undefined : "") };
		if (calls.length) msg.tool_calls = calls;
		out.push(msg);
	}
	return out;
}

export interface GroqResult {
	stop_reason: "end_turn" | "tool_use";
	content: Anthropic.ContentBlock[];
	model: string;
}

/**
 * Stream one turn from Groq. `send` receives the same pieces the primary path
 * emits ({type:"text"} / {type:"thinking"}); the return value is the final
 * Anthropic-shaped message for the `done` piece.
 */
export async function streamGroq(
	member: Member,
	system: string,
	messages: Anthropic.MessageParam[],
	send: (piece: unknown) => void,
	options: { signal?: AbortSignal; allowImages?: boolean } = {},
): Promise<GroqResult> {
	const key = process.env.GROQ_API_KEY;
	if (!key) throw new Error("GROQ_API_KEY is not set");
	const model = GROQ_MODELS[member]();
	const body = {
		model,
		stream: true,
		temperature: 0.2,
		max_tokens: 4096,
		messages: toOpenAI(system, messages, options.allowImages ?? false),
		tools: TOOL_DEFINITIONS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
		tool_choice: "auto",
	};
	const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
		body: JSON.stringify(body),
		signal: options.signal,
	});
	if (!response.ok || !response.body) {
		const detail = await response.text().catch(() => "");
		throw new Error(`Groq ${response.status}: ${detail.slice(0, 300)}`);
	}

	let text = "";
	const calls = new Map<number, { id: string; name: string; args: string }>();
	let finish = "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const handle = (line: string) => {
		if (!line.startsWith("data:")) return;
		const payload = line.slice(5).trim();
		if (payload === "" || payload === "[DONE]") return;
		let json: {
			choices?: Array<{
				finish_reason?: string | null;
				delta?: { content?: string | null; reasoning?: string | null; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
			}>;
		};
		try {
			json = JSON.parse(payload);
		} catch {
			return;
		}
		const choice = json.choices?.[0];
		if (!choice) return;
		if (choice.delta?.reasoning) send({ type: "thinking", text: choice.delta.reasoning });
		if (choice.delta?.content) {
			text += choice.delta.content;
			send({ type: "text", text: choice.delta.content });
		}
		for (const tc of choice.delta?.tool_calls ?? []) {
			const slot = calls.get(tc.index) ?? { id: tc.id ?? `groq-call-${tc.index}-${Date.now().toString(36)}`, name: "", args: "" };
			if (tc.id) slot.id = tc.id;
			if (tc.function?.name) slot.name = tc.function.name;
			if (tc.function?.arguments) slot.args += tc.function.arguments;
			calls.set(tc.index, slot);
		}
		if (choice.finish_reason) finish = choice.finish_reason;
	};
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let nl: number;
		while ((nl = buffer.indexOf("\n")) >= 0) {
			handle(buffer.slice(0, nl).trim());
			buffer = buffer.slice(nl + 1);
		}
	}
	if (buffer.trim()) handle(buffer.trim());

	const content: Anthropic.ContentBlock[] = [];
	if (text) content.push({ type: "text", text, citations: null } as Anthropic.TextBlock);
	for (const call of [...calls.values()]) {
		let input: Record<string, unknown> = {};
		try {
			input = call.args ? JSON.parse(call.args) : {};
		} catch {
			input = { raw: call.args };
		}
		content.push({ type: "tool_use", id: call.id, name: call.name, input } as Anthropic.ToolUseBlock);
	}
	return { stop_reason: calls.size > 0 || finish === "tool_calls" ? "tool_use" : "end_turn", content, model };
}
