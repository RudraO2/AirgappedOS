/**
 * The fleet of this build: two hosted Anthropic models standing in for the
 * prototype's two local open-weight models. Same schema as `registry/models.yaml`
 * so `router/score.js` ports unchanged.
 *
 * `modalities` on the coder is declared `[text]` as a ROUTING POLICY, not a
 * capability claim: Sonnet 5 accepts images, but this build sends an attached
 * image to the vision lane only, so the coder is declared text-only here and
 * the router's modality gate produces a real exclusion reason for it.
 *
 * The licence gate is not applicable in this build (closed models, commercial
 * terms) and is not run. The local build's `ALLOWED_LICENCES` still governs the
 * real product.
 */
export const FLEET = [
	{
		name: "claude-sonnet-5",
		member: "coder",
		role: "coder",
		display: "Claude Sonnet 5",
		licence: "Anthropic commercial terms",
		size: "hosted",
		context: 1000000,
		modalities: ["text"],
		capabilities: ["code-generation", "code-reasoning", "tool-use", "general-reasoning", "instruction-following"],
	},
	{
		name: "claude-haiku-4-5-20251001",
		member: "vision",
		role: "vision-document",
		display: "Claude Haiku 4.5",
		licence: "Anthropic commercial terms",
		size: "hosted",
		context: 200000,
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
