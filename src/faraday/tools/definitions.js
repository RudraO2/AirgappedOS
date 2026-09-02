/**
 * The tools Faraday exposes to the model. Shared by the browser (which executes
 * them against the simulated workstation) and `api/turn.ts` (which hands the
 * schemas to the model). Plain ESM so both sides import the same object.
 *
 * `bf_approval_note`'s schema is the prototype's, verbatim
 * (`reference/plugins/dsh-client-ui-base/lib/deliverables/tool.js`).
 */

export const TOOL_DEFINITIONS = [
	{
		name: "pwsh",
		description:
			"Run one PowerShell-shaped command in the workstation's terminal. The terminal window opens on screen and the operator watches it run. " +
			"Available: Get-ChildItem/ls/dir, Set-Location/cd, Get-Content/cat, Set-Content, New-Item, Remove-Item, Write-Output/echo, Get-Date, Get-Process, hostname, whoami, " +
			"and `node -e \"<javascript>\"` for a calculation (use console.log to print the result). Python is not installed on this workstation.",
		input_schema: {
			type: "object",
			properties: {
				command: { type: "string", description: "The command text, exactly as it should be typed." },
				description: { type: "string", description: "One short line saying what the command is for." },
			},
			required: ["command", "description"],
			additionalProperties: false,
		},
	},
	{
		name: "browser_open",
		description: "Open a URL in the workstation's browser. This reaches the network; the seal decides whether it may run.",
		input_schema: {
			type: "object",
			properties: { url: { type: "string", description: "Absolute URL, e.g. https://example.com" } },
			required: ["url"],
			additionalProperties: false,
		},
	},
	{
		name: "read_file",
		description: "Read a text file from the workstation. Paths are Windows-style. The inspection report is C:\Users\Operator\Documents\Inspection reports\NRC-RVF-INSP-2026-0417.txt. A bare file name is found anywhere on the workstation.",
		input_schema: {
			type: "object",
			properties: { path: { type: "string" } },
			required: ["path"],
			additionalProperties: false,
		},
	},
	{
		name: "write_file",
		description: "Write a text file on the workstation. Creates parent folders. The file opens in Notepad so the operator can see it.",
		input_schema: {
			type: "object",
			properties: { path: { type: "string" }, content: { type: "string" } },
			required: ["path", "content"],
			additionalProperties: false,
		},
	},
	{
		name: "open_file",
		description: "Open a file on the workstation for the operator to see: text files open in Notepad, images in Photos, folders in File Explorer. Returns nothing but confirmation.",
		input_schema: {
			type: "object",
			properties: { path: { type: "string" } },
			required: ["path"],
			additionalProperties: false,
		},
	},
	{
		name: "list_dir",
		description: "List a folder on the workstation. File Explorer navigates there on screen.",
		input_schema: {
			type: "object",
			properties: { path: { type: "string" } },
			required: ["path"],
			additionalProperties: false,
		},
	},
	{
		name: "bf_approval_note",
		description:
			"Generate a signed approval note as a real .docx from a set of cited clauses. Quote each clause from the source it came from rather than paraphrasing it. " +
			"The produced file is written to the workstation's Documents\Deliverables folder and offered for download.",
		input_schema: {
			type: "object",
			properties: {
				title: { type: "string", description: 'Titleblock heading, e.g. "Approval Note".' },
				referenceNumber: { type: "string", description: 'A reference number for this note, e.g. "NRC-APPR-0001".' },
				sourceReport: { type: "string", description: "The document or image the clauses were read from." },
				clauses: {
					type: "array",
					minItems: 1,
					description: "Findings to cite.",
					items: {
						type: "object",
						properties: {
							text: { type: "string", description: "The finding, in full." },
							tag: { type: "string", description: "Equipment tag this finding concerns, if any." },
						},
						required: ["text"],
						additionalProperties: false,
					},
				},
			},
			required: ["title", "referenceNumber", "sourceReport", "clauses"],
			additionalProperties: false,
		},
	},
];

/** Tool names known to reach outside the machine — denied by name while sealed. */
export const NETWORK_TOOL_NAMES = new Set(["web_search", "web_fetch", "browser_open"]);
