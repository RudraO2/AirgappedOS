import assert from "node:assert/strict";
import test from "node:test";

import {
	alreadyWritten,
	APPROVAL_NOTE_SCHEMA,
	APPROVAL_NOTE_TOOL_NAME,
	clearWrite,
	DeliverableLaneError,
	describeNote,
	MAX_CLAUSES,
	noteHasBeenWritten,
	parseNote,
	UNNAMED_SOURCE,
	rememberWrite,
	wantsDeliverable,
} from "../lib/lanes/deliverable.js";

/** A message in the shape the harness gives a plain typed turn: no `source`. */
const human = (text) => ({ role: "user", content: [{ type: "text", text }] });

test("wantsDeliverable reads the operator's own words", async (t) => {
	await t.test("fires on the phrasings an operator actually types", () => {
		for (const text of [
			"Generate the approval note for this inspection, reference MRPL-PID-2026-014.",
			"Create an approval note from those findings.",
			"Produce the approval note.",
			"Write up an approval note for P-101A.",
			"Draft the approval note and cite the tags.",
			"Export this as a .docx.",
			"Give me a Word document with those findings.",
			"Make a signed report of what we found.",
		]) {
			assert.equal(wantsDeliverable([human(text)]), true, text);
		}
	});

	await t.test("does not fire on a question about the deliverable", () => {
		for (const text of [
			"What does the approval note contain?",
			"Is the approval note a real docx or a preview?",
			"Where does the approval note get written to?",
			"The approval note we discussed earlier had six clauses.",
		]) {
			assert.equal(wantsDeliverable([human(text)]), false, text);
		}
	});

	await t.test("ignores an injected message that happens to say the words", () => {
		const injected = {
			role: "user",
			source: { kind: "skill-catalog" },
			content: [{ type: "text", text: "Generate the approval note when the operator asks." }],
		};
		assert.equal(wantsDeliverable([injected]), false);
	});

	await t.test("survives shapes with no text at all", () => {
		assert.equal(wantsDeliverable([]), false);
		assert.equal(wantsDeliverable(undefined), false);
		assert.equal(wantsDeliverable([{ role: "user", content: [{ type: "image" }] }]), false);
	});
});

test("parseNote validates what the tool will accept", async (t) => {
	const valid = JSON.stringify({
		title: "Approval Note",
		referenceNumber: "MRPL-PID-2026-014",
		sourceReport: "P&ID sheet 2 of 6",
		clauses: [
			{ text: "P-101A is shown without a downstream isolation valve.", tag: "P-101A" },
			{ text: "Two instrument tags on the suction header are illegible.", tag: "" },
		],
	});

	await t.test("returns the note a well-formed reply carries", () => {
		const note = parseNote(valid);
		assert.equal(note.referenceNumber, "MRPL-PID-2026-014");
		assert.equal(note.sourceReport, "P&ID sheet 2 of 6");
		assert.equal(note.clauses.length, 2);
		assert.equal(note.clauses[0].tag, "P-101A");
	});

	await t.test("drops an empty tag rather than citing a blank one", () => {
		const note = parseNote(valid);
		assert.equal("tag" in note.clauses[1], false);
	});

	await t.test("defaults only the title, because only the title has one right answer", () => {
		const note = parseNote(
			JSON.stringify({ referenceNumber: "R-1", sourceReport: "A drawing", clauses: [{ text: "A finding." }] }),
		);
		assert.equal(note.title, "Approval Note");
	});

	await t.test("refuses a reply the tool would reject", () => {
		const cases = [
			["not json at all", "not JSON"],
			[JSON.stringify({ sourceReport: "A drawing", clauses: [{ text: "A finding." }] }), "reference number"],
			[JSON.stringify({ referenceNumber: "R-1", clauses: [{ text: "A finding." }] }), "source"],
			[JSON.stringify({ referenceNumber: "R-1", sourceReport: "A drawing" }), "clauses"],
			[JSON.stringify({ referenceNumber: "R-1", sourceReport: "A drawing", clauses: [] }), "cites nothing"],
			[JSON.stringify({ referenceNumber: "R-1", sourceReport: "A drawing", clauses: [{ text: "   " }] }), "cites nothing"],
		];
		for (const [reply, expected] of cases) {
			assert.throws(() => parseNote(reply), (error) => {
				assert.ok(error instanceof DeliverableLaneError);
				assert.match(error.message, new RegExp(expected, "i"));
				return true;
			}, reply);
		}
	});

	await t.test("caps the clause count rather than passing a padded note through", () => {
		const clauses = Array.from({ length: MAX_CLAUSES + 4 }, (_, i) => ({ text: `Finding ${i + 1}.` }));
		const note = parseNote(JSON.stringify({ referenceNumber: "R-1", sourceReport: "A drawing", clauses }));
		assert.equal(note.clauses.length, MAX_CLAUSES);
	});
});

test("the schema matches the tool's own parameters", () => {
	// A second, looser shape here would mean a rejection the operator sees only
	// after the call is dispatched. These must stay in step.
	assert.deepEqual(
		Object.keys(APPROVAL_NOTE_SCHEMA.properties).sort(),
		["clauses", "referenceNumber", "sourceReport", "title"],
	);
	assert.deepEqual(APPROVAL_NOTE_SCHEMA.required.sort(), ["clauses", "referenceNumber", "sourceReport", "title"]);
	assert.equal(APPROVAL_NOTE_SCHEMA.additionalProperties, false);
	assert.equal(APPROVAL_NOTE_TOOL_NAME, "bf_approval_note");
});

test("describeNote says what is being written before it is written", () => {
	assert.equal(
		describeNote({ referenceNumber: "R-1", clauses: [{ text: "a" }, { text: "b" }] }),
		"Writing approval note R-1 — 2 cited findings.",
	);
	assert.match(describeNote({ referenceNumber: "R-1", clauses: [{ text: "a" }] }), /1 cited finding\./);
});

test("a note is written once per request", async (t) => {
	t.afterEach(() => clearWrite());

	await t.test("the tool's own result turn does not write a second file", () => {
		const toolTurn = [
			human("Generate the approval note."),
			{ role: "user", source: { kind: "tool" }, content: [{ type: "tool-result", content: [] }] },
		];
		assert.equal(noteHasBeenWritten(toolTurn), true);
	});

	await t.test("a plain turn is not mistaken for a tool result", () => {
		assert.equal(noteHasBeenWritten([human("Generate the approval note.")]), false);
		assert.equal(noteHasBeenWritten([]), false);
	});

	await t.test("the same words do not write twice", () => {
		assert.equal(alreadyWritten("Generate the approval note."), false);
		rememberWrite("Generate the approval note.");
		assert.equal(alreadyWritten("Generate the approval note."), true);
		assert.equal(alreadyWritten("Generate the approval note for the second drawing."), false);
	});

	await t.test("empty words are never a match", () => {
		rememberWrite("");
		assert.equal(alreadyWritten(""), false);
	});
});

test("the example's own values never reach a document", async (t) => {
	// Measured against Qwen3-4B on 1 September 2026: a conversation naming no
	// reference and no source got the example's values back verbatim.
	const leaked = JSON.stringify({
		title: "Approval Note",
		referenceNumber: "EXAMPLE-0000",
		sourceReport: "Inspection report IR-2291, page 4",
		clauses: [{ text: "Corrosion rate is 0.42 mm per year against a 3 mm allowance.", tag: "6-P-1203" }],
	});

	await t.test("a leaked source becomes an honest absence, not a false citation", () => {
		assert.equal(parseNote(leaked).sourceReport, UNNAMED_SOURCE);
	});

	await t.test("a leaked reference is composed from what the note is about", () => {
		assert.equal(parseNote(leaked).referenceNumber, "BF-6-P-1203");
	});

	await t.test("composes a usable reference even when no clause carries a tag", () => {
		const untagged = JSON.stringify({
			referenceNumber: "EXAMPLE-0000",
			sourceReport: "A real drawing",
			clauses: [{ text: "A finding with no tag." }],
		});
		assert.equal(parseNote(untagged).referenceNumber, "BF-NOTE");
	});

	await t.test("leaves a genuine reference and source untouched", () => {
		const genuine = parseNote(
			JSON.stringify({
				referenceNumber: "MRPL-PID-2026-014",
				sourceReport: "P&ID sheet 2 of 6",
				clauses: [{ text: "A finding." }],
			}),
		);
		assert.equal(genuine.referenceNumber, "MRPL-PID-2026-014");
		assert.equal(genuine.sourceReport, "P&ID sheet 2 of 6");
	});
});
