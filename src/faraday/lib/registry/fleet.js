/**
 * The fleet of this build: two hosted open-weight models on Groq standing in
 * for the prototype's two local models. Same schema as `registry/models.yaml`
 * so `router/score.js` ports unchanged. If Groq does not answer, the server
 * falls back to Gemma 4 on the Gemini API and the transcript says so.
 *
 * `modalities` on the coder is declared `[text]` as a ROUTING POLICY: this
 * build sends an attached image to the vision lane only, so the router's
 * modality gate produces a real exclusion reason for the coder.
 *
 * The licence gate is not run in this build (hosted inference, provider
 * terms). The local build's `ALLOWED_LICENCES` still governs the real product.
 */
export const FLEET = [
	{
		name: "openai/gpt-oss-20b",
		member: "coder",
		role: "coder",
		display: "GPT-OSS 20B",
		licence: "Apache-2.0 (weights); hosted on Groq",
		size: "20B",
		context: 131072,
		modalities: ["text"],
		capabilities: ["code-generation", "code-reasoning", "tool-use", "general-reasoning", "instruction-following"],
	},
	{
		name: "qwen/qwen3.8-27b",
		member: "vision",
		role: "vision-document",
		display: "Qwen3.8 27B",
		licence: "Apache-2.0 (weights); hosted on Groq",
		size: "27B",
		context: 131042,
		modalities: ["text", "image"],
		capabilities: ["document-understanding", "drawing-understanding", "visual-grounding", "general-reasoning", "instruction-following", "tool-use"],
	},
];

/** The `member` key `api/turn.ts` understands for a fleet member name, or "coder" when unknown. */
export function memberFor(name) {
	return FLEET.find((m) => m.name === name)?.member ?? "coder";
}

export function displayFor(name) {
	return FLEET.find((m) => m.name === name)?.display ?? name;
}

/** The plane label shown beside every answer and in the audit trail. */
export const PLANE_LABEL = "Groq API";
