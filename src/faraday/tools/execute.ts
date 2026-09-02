/**
 * The tool executor: the seam where a model's tool call lands on the
 * simulated workstation. The egress denial waterfall runs here BEFORE any
 * body, exactly as the prototype's `tools/pre-execute` listener did.
 */
import { browser } from "../../os/kernel/browser";
import { normalizePath, HOME } from "../../os/kernel/fs";
import { launch } from "../../os/kernel/launch";
import { shell } from "../../os/kernel/shell";
import { os } from "../../os/kernel/store";
import { buildAuditTrail } from "../lib/deliverables/audit-trail.js";
import { buildApprovalNoteDocx } from "../lib/deliverables/docx.js";
import { describeTarget, EGRESS_DENIED_EVENT, NETWORK_TOOL_NAMES, PERMITTED_EVENT, PWSH_TOOL_NAME, pwshCommandText, sandboxDenialReason } from "../lib/egress/policy.js";
import { isSealed } from "../lib/egress/seal.js";
import { displayFor } from "../lib/registry/fleet.js";
import { recordTool, toolsRunThisTurn } from "../lib/trace/turn.js";
import { faraday } from "../store";

export interface ToolOutcome {
	content: string;
	isError?: boolean;
	status: "done" | "denied" | "error";
	produced?: { path: string; name: string };
}

const APPROVAL_NOTE_TOOL_NAME = "bf_approval_note";

export async function executeTool(name: string, input: Record<string, unknown>, context: { images: number }): Promise<ToolOutcome> {
	const { appendEvent } = faraday.get();

	// The egress denial waterfall, consulting the seal.
	if (NETWORK_TOOL_NAMES.has(name)) {
		const target = describeTarget(input);
		if (isSealed()) {
			appendEvent(EGRESS_DENIED_EVENT, { tool: name, target });
			os.toast({ title: "Outbound call denied.", body: `${name} → ${target}`, tone: "error" });
			recordTool(name, { outcome: "denied by the seal" });
			return { content: `Faraday denies outbound network access: "${name}" attempted to reach ${target}`, isError: true, status: "denied" };
		}
		appendEvent(PERMITTED_EVENT, { tool: name, target });
	}
	if (name === PWSH_TOOL_NAME) {
		const command = pwshCommandText(input);
		const denial = command === undefined ? undefined : sandboxDenialReason(command);
		if (denial !== undefined) {
			if (isSealed()) {
				appendEvent(EGRESS_DENIED_EVENT, { tool: name, target: command });
				os.toast({ title: "Outbound call denied.", body: `${name} → ${command}`, tone: "error" });
				recordTool(name, { outcome: "denied by the seal" });
				return { content: `Faraday denies outbound network access: "${name}" ${denial}`, isError: true, status: "denied" };
			}
			appendEvent(PERMITTED_EVENT, { tool: name, target: command });
		}
	}

	try {
		switch (name) {
			case "pwsh": {
				const command = String(input.command ?? "");
				launch("terminal");
				await new Promise((r) => setTimeout(r, 250));
				const result = await shell.get().run(command, { animate: true });
				recordTool(name, { outcome: result.exitCode === 0 ? `exit code 0` : `exit code ${result.exitCode}` });
				return { content: `${result.output}\n[exit code: ${result.exitCode}]`, status: result.exitCode === 0 ? "done" : "error", isError: result.exitCode !== 0 };
			}
			case "browser_open": {
				const url = String(input.url ?? "");
				launch("browser");
				browser.get().openTab(url);
				recordTool(name, { outcome: `opened ${url}` });
				return { content: `Opened ${url} in the workstation's browser. The page is on screen; you cannot read its contents from here.`, status: "done" };
			}
			case "read_file": {
				const path = normalizePath(String(input.path ?? ""), HOME);
				const fs = os.get().fs;
				const text = fs.readText(path);
				launch("explorer", { path: path.slice(0, path.lastIndexOf("\\")), highlight: path.slice(path.lastIndexOf("\\") + 1) });
				recordTool(name, { outcome: `read ${path}` });
				return { content: text, status: "done" };
			}
			case "write_file": {
				const path = normalizePath(String(input.path ?? ""), HOME);
				const content = String(input.content ?? "");
				os.get().fs.write(path, content);
				os.touchFs();
				launch("notepad", { path }, `${path.slice(path.lastIndexOf("\\") + 1)} - Notepad`);
				recordTool(name, { outcome: `wrote ${path}` });
				return { content: `Written ${content.length} characters to ${path}.`, status: "done" };
			}
			case "list_dir": {
				const path = normalizePath(String(input.path ?? HOME), HOME);
				const rows = os.get().fs.list(path);
				launch("explorer", { path });
				recordTool(name, { outcome: `listed ${path}` });
				return { content: rows.map((n) => (n.kind === "dir" ? `${n.name}\\` : n.name)).join("\n") || "(empty)", status: "done" };
			}
			case APPROVAL_NOTE_TOOL_NAME:
				return await approvalNote(input, context);
			default:
				return { content: `Unknown tool "${name}".`, isError: true, status: "error" };
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		recordTool(name, { outcome: `failed — ${message}` });
		return { content: message, isError: true, status: "error" };
	}
}

function sanitizeForFilename(text: string) {
	const cleaned = text.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	return cleaned === "" ? "untitled" : cleaned;
}

async function sha256Hex(text: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function approvalNote(input: Record<string, unknown>, context: { images: number }): Promise<ToolOutcome> {
	const title = String(input.title ?? "").trim();
	const referenceNumber = String(input.referenceNumber ?? "").trim();
	const sourceReport = String(input.sourceReport ?? "").trim();
	const clauses = Array.isArray(input.clauses) ? (input.clauses as Array<{ text?: unknown; tag?: unknown }>) : [];
	if (!title) throw new Error("invalid title: expected a non-empty string");
	if (!referenceNumber) throw new Error("invalid referenceNumber: expected a non-empty string");
	if (!sourceReport) throw new Error("invalid sourceReport: expected a non-empty string");
	if (clauses.length === 0) throw new Error("invalid clauses: expected a non-empty array");
	const cleanClauses = clauses.map((c, i) => {
		if (typeof c?.text !== "string" || c.text.trim() === "") throw new Error(`invalid clauses[${i}].text: expected a non-empty string`);
		return { text: c.text.trim(), tag: typeof c.tag === "string" && c.tag.trim() !== "" ? c.tag.trim() : undefined };
	});

	const session = faraday.get().current();
	const routing = session.routing;
	const selected = routing?.selected ?? null;
	const denied = session.events.filter((e) => e.type === EGRESS_DENIED_EVENT).length;
	const contentHash = await sha256Hex(JSON.stringify({ title, referenceNumber, sourceReport, clauses: cleanClauses }));
	const generatedAt = new Date().toISOString();

	let auditTrail: string[] | undefined;
	try {
		auditTrail = buildAuditTrail({
			routing,
			dispatch: selected ? { runtimeId: selected, member: displayFor(selected), reason: "routed" } : undefined,
			providerName: "hosted",
			images: context.images,
			tools: [...toolsRunThisTurn(), { name: APPROVAL_NOTE_TOOL_NAME, outcome: `${cleanClauses.length} clauses cited` }],
			egressDenied: denied,
		}).lines;
	} catch {
		auditTrail = undefined;
	}

	const bytes = buildApprovalNoteDocx({ title, referenceNumber, sourceReport, generatedAt, clauses: cleanClauses, contentHash, auditTrail });
	const fileName = `approval-note-${sanitizeForFilename(referenceNumber)}.docx`;
	const dir = `${HOME}\\Documents\\Deliverables`;
	const path = `${dir}\\${fileName}`;
	os.get().fs.write(path, bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
	os.touchFs();
	launch("explorer", { path: dir, highlight: fileName });
	os.toast({ title: "Deliverable produced.", body: fileName, tone: "done" });
	recordTool(APPROVAL_NOTE_TOOL_NAME, { outcome: `${cleanClauses.length} clauses cited` });
	return {
		content: `Approval note ${referenceNumber} written to ${path} (${cleanClauses.length} cited findings, SHA-256 ${contentHash}).`,
		status: "done",
		produced: { path, name: fileName },
	};
}
