/**
 * The deliverable lane: how "generate the approval note" becomes a real `.docx`
 * on the `local` provider, rather than a paragraph describing one.
 *
 * ## Why this lane has to exist at all
 *
 * `bf_approval_note` is registered, tested and writes a genuine OOXML package
 * (`deliverables/tool.js`). It is nonetheless uncallable on `local`, for the
 * reason recorded in `model-plane/local-provider.js` and already worked around
 * twice: that provider sends no tool definitions, so the model has nothing to
 * call. Asked for a document it does the only thing left open to it — it writes
 * the document out as chat text. The deliverable factory is the reason this is a
 * workbench and not a chatbot, so a turn that ends in prose is the one outcome
 * that most undercuts the claim.
 *
 * This lane closes that gap exactly as the coding and fan-out lanes closed
 * theirs: the model fills in a shape under a sampling constraint, and **our
 * code** makes the tool call. What the harness then dispatches is the real
 * registered tool, writing a real file through the same path a `replay` run
 * uses. Nothing about the document becomes ours; only the decision to call.
 *
 * ## Why the operator's words select this lane
 *
 * The router classifies a request into a task *type*, and asking for a
 * deliverable is orthogonal to all four: findings from a drawing, a calculation
 * or a code review can each be written up, and each of those is a different
 * type. There is no type this lane could claim without also claiming turns that
 * must stay in the transcript. So the trigger is the operator asking for the
 * document, in their own words — the same answer, for the same reason, as
 * `lanes/fanout.js`.
 *
 * ## Why the clauses are the model's and the audit trail is not
 *
 * The model supplies the findings and where they were read from. Everything
 * about *how the note was produced* — the task type, the per-member scores, the
 * model that answered, how many images it was sent, which tools ran — is
 * assembled by `deliverables/audit-trail.js` from the same live state the panels
 * read. A model asked to describe its own routing would be writing a claim; the
 * audit trail is a record. Keeping that boundary is what makes the section
 * worth opening the file for.
 */

import { isGenuineHumanMessage, lastGenuineUserMessage } from "../model-plane/injected.js";

/** The registered tool this lane calls — the real one, dispatched by the harness. */
export const APPROVAL_NOTE_TOOL_NAME = "bf_approval_note";

/** The most clauses one note will carry. Beyond this the model is padding, not citing. */
export const MAX_CLAUSES = 6;

/**
 * Does the operator's own message ask for the deliverable?
 *
 * Strict on the verb, broad on the noun — the same split fan-out uses, and for
 * the same reason: "what does the approval note contain?" must not write one.
 * `.docx` and "Word document" are here because an operator asking for a file
 * format is asking for the factory just as plainly as one who names the note.
 */
const DELIVERABLE_PATTERN =
	/\b(?:generate|create|produce|write|draft|issue|export|make|give\s+me)\b[\s\S]{0,80}?(?:\bapproval\s+note\b|\bdocx\b|\.docx\b|\bword\s+document\b|\bsigned\s+(?:note|document|report)\b)/i;

/**
 * Whether this turn is the operator asking for a deliverable.
 *
 * Read from the last genuine human message, so a skill's injected preamble or a
 * tool result echoing the words cannot trigger the factory. Same guard, same
 * source, as `wantsDelegation`.
 * @param {unknown[]} messages - the harness's message list for this turn.
 */
export function wantsDeliverable(messages) {
	const message = lastGenuineUserMessage(messages);
	if (message === undefined || !isGenuineHumanMessage(message)) return false;
	return DELIVERABLE_PATTERN.test(textOf(message));
}

/** The plain text of a message, whichever content shape it arrived in. */
function textOf(message) {
	const content = message?.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block) => block?.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

/**
 * What the model must return. Deliberately the tool's own parameter shape minus
 * nothing — a second, looser shape here would mean two contracts to keep in step
 * and a validation error the operator sees only after the call is dispatched.
 */
export const APPROVAL_NOTE_SCHEMA = {
	type: "object",
	properties: {
		title: {
			type: "string",
			description: "Titleblock heading. Usually \"Approval Note\".",
		},
		referenceNumber: {
			type: "string",
			description:
				"The reference the operator gave. If they gave none, compose one from the subject, " +
				"letters digits and dashes only.",
		},
		sourceReport: {
			type: "string",
			description: "The document, drawing or image these findings were read from.",
		},
		clauses: {
			type: "array",
			minItems: 1,
			maxItems: MAX_CLAUSES,
			items: {
				type: "object",
				properties: {
					text: {
						type: "string",
						description:
							"One finding, stated in full and standing on its own. Quote what was found " +
							"rather than paraphrasing it, and never write 'as noted above'.",
					},
					tag: {
						type: "string",
						description: "The equipment tag this finding concerns, e.g. \"P-101A\". Empty string if none.",
					},
				},
				required: ["text", "tag"],
				additionalProperties: false,
			},
		},
	},
	required: ["title", "referenceNumber", "sourceReport", "clauses"],
	additionalProperties: false,
};

/** A name for the schema, so a server-side rejection says which one failed. */
export const APPROVAL_NOTE_SCHEMA_NAME = "bf_approval_note_plan";

/** A ceiling that fits a full note and stops a rambling model truncating its own JSON mid-string. */
export const DELIVERABLE_LANE_MAX_TOKENS = 900;

/**
 * Shown the shape rather than told about it — the lesson the coding lane learned
 * on 30 August 2026, where describing the requirement did not work and
 * demonstrating it did.
 *
 * The standing-alone rule is the one that matters here. The note leaves the
 * room: a clause reading "the second one is worse" is unreadable to the person
 * who receives the file and has never seen this conversation.
 */
export const DELIVERABLE_LANE_SYSTEM_PROMPT = [
	"You return only JSON matching the schema. No prose, no code fences.",
	"You are writing up findings from this conversation as a formal approval note.",
	"",
	"- Take the findings from what was actually established in this conversation.",
	"  Never invent a finding, a tag or a measurement that was not discussed.",
	"- Each clause must stand alone. The person who receives this file has not read",
	"  this conversation. Never write 'the above', 'as noted' or 'the second one'.",
	"- `tag` is the equipment tag the clause concerns. Use an empty string when the",
	"  clause concerns no single tag.",
	"- `sourceReport` names what the findings were read from — the drawing, the",
	"  photograph or the report, as it was described in this conversation. When the",
	"  findings came from a calculation done here and no document was named, write",
	"  'Calculation performed in this session'. NEVER name a document nobody mentioned.",
	"- Use the reference number the operator gave, exactly as they wrote it. When they",
	"  gave none, compose one from the subject — for a corrosion review of line",
	"  6-P-1203, 'CORR-6-P-1203'. Letters, digits and dashes only.",
	`- Never return more than ${MAX_CLAUSES} clauses. Cite the substantial findings, not every remark.`,
	"- Do NOT describe how the note was produced. That section is added by the system",
	"  from its own record, and anything you write about it would be a guess.",
	"- Never carry a date, a name or a number over from this example. Measured on",
	"  1 September 2026: an example carrying a date got that date copied into a note",
	"  whose conversation never mentioned one. Every value you return must come from",
	"  the conversation above.",
	"",
	"Example, for 'generate the approval note, reference EXAMPLE-0000':",
	'{"title": "Approval Note", "referenceNumber": "EXAMPLE-0000", ' +
		'"sourceReport": "Inspection report IR-2291, page 4", "clauses": [' +
		'{"text": "Pump P-101A is shown without a downstream isolation valve on the discharge line.", "tag": "P-101A"}, ' +
		'{"text": "Two instrument tags on the suction header are illegible and could not be read.", "tag": ""}' +
		"]}",
].join("\n");

/**
 * The example's own values, which must never reach a document.
 *
 * Measured on 1 September 2026 against `Qwen3-4B`: given a conversation that
 * named no reference and no source document, the model returned the example's
 * `EXAMPLE-0000` and `Inspection report IR-2291, page 4` verbatim — correct
 * clauses, cited to a report that does not exist. The system prompt now forbids
 * it and mostly holds, but a false citation in a signed note is the failure this
 * lane can least afford, so the shape is also refused in code. Belt and braces,
 * deliberately: the prompt is a request and this is a guarantee.
 */
const EXAMPLE_REFERENCE = "EXAMPLE-0000";
const EXAMPLE_SOURCE = "Inspection report IR-2291, page 4";

/** What a note says when the model could name no document, rather than naming a wrong one. */
export const UNNAMED_SOURCE = "Not stated — findings established in this session";

/**
 * A reference composed from what the note is actually about, for when the
 * operator gave none and the model echoed the example instead of composing one.
 *
 * Deterministic and derived from the note itself. Composing an identifier is
 * safe in a way that composing a *source* is not: a reference number labels the
 * document, where a source is a claim about where its content came from.
 */
function composedReference(clauses) {
	const tag = clauses.find((clause) => typeof clause.tag === "string" && clause.tag !== "")?.tag;
	const subject = tag === undefined ? "NOTE" : tag.replaceAll(/[^A-Za-z0-9-]+/g, "-");
	return `BF-${subject}`;
}

/** Thrown when the model's schema-constrained reply cannot be used. */
export class DeliverableLaneError extends Error {
	constructor(message) {
		super(message);
		this.name = "DeliverableLaneError";
	}
}

/**
 * The note in the model's reply, validated against what the tool will accept.
 *
 * Validated here rather than left to the tool because a rejection at dispatch
 * is a failed turn the operator watches; a rejection here is a fallback to a
 * plain answer.
 * @param {string} text - the model's schema-constrained reply.
 */
export function parseNote(text) {
	let parsed;
	try {
		parsed = JSON.parse(String(text ?? ""));
	} catch {
		throw new DeliverableLaneError("the model's reply was not JSON");
	}

	const note = {
		title: trimmedString(parsed?.title) ?? "Approval Note",
		referenceNumber: trimmedString(parsed?.referenceNumber),
		sourceReport: trimmedString(parsed?.sourceReport),
		clauses: [],
	};

	if (note.referenceNumber === undefined) throw new DeliverableLaneError("the note has no reference number");
	if (note.sourceReport === undefined) throw new DeliverableLaneError("the note names no source");
	if (!Array.isArray(parsed?.clauses)) throw new DeliverableLaneError("the note has no clauses");

	for (const clause of parsed.clauses.slice(0, MAX_CLAUSES)) {
		const clauseText = trimmedString(clause?.text);
		if (clauseText === undefined) continue;
		const tag = trimmedString(clause?.tag);
		note.clauses.push(tag === undefined ? { text: clauseText } : { text: clauseText, tag });
	}

	if (note.clauses.length === 0) throw new DeliverableLaneError("the note cites nothing");

	// The example's values, scrubbed after the clauses are known so the reference
	// can be composed from them. A note still comes out — the findings themselves
	// were never the leaky part — but it cites nothing that does not exist.
	if (note.referenceNumber === EXAMPLE_REFERENCE) note.referenceNumber = composedReference(note.clauses);
	if (note.sourceReport === EXAMPLE_SOURCE) note.sourceReport = UNNAMED_SOURCE;

	return note;
}

/** A non-empty trimmed string, or undefined. */
function trimmedString(value) {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

/**
 * The line shown above the call, so the operator reads what is being written
 * before the file appears rather than after.
 * @param {{ referenceNumber: string, clauses: unknown[] }} note
 */
export function describeNote(note) {
	const count = note.clauses.length;
	return `Writing approval note ${note.referenceNumber} — ${count} cited ${count === 1 ? "finding" : "findings"}.`;
}

/**
 * Has the tool already reported back on this turn?
 *
 * The harness runs a further turn carrying the tool result, and the operator's
 * words still ask for a note in it. Without this the lane writes the document
 * again, forever. Same shape as the coding lane's own `sandboxHasReported`.
 * @param {unknown[]} messages
 */
export function noteHasBeenWritten(messages) {
	const last = Array.isArray(messages) ? messages.at(-1) : undefined;
	if (last?.role !== "user" || last?.source?.kind !== "tool") return false;
	return Array.isArray(last.content) && last.content.some((block) => block?.type === "tool-result");
}

/**
 * The request a note was last written for.
 *
 * A second guard beside {@link noteHasBeenWritten}, for the same reason fan-out
 * keeps one: a generator abandoned part-way still caused a real file to be
 * written, and re-entering must not write a second.
 */
let writtenFor = null;

/** Was a note already produced for these exact words? */
export function alreadyWritten(trigger) {
	const text = String(trigger ?? "").trim();
	return text !== "" && text === writtenFor;
}

/** Record that a note went out for this request. */
export function rememberWrite(trigger) {
	writtenFor = String(trigger ?? "").trim();
}

/** Forget the request in flight. Exists for tests and for a cleared session. */
export function clearWrite() {
	writtenFor = null;
}
