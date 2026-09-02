/**
 * The virtual filesystem of the simulated workstation. In memory, seeded at
 * boot. Paths are Windows-style (`C:\Users\Operator\Documents`), matched
 * case-insensitively, with `/` tolerated.
 */
export type FsNode =
	| { kind: "dir"; name: string; children: Map<string, FsNode>; modified: number }
	| { kind: "file"; name: string; data: string | Uint8Array; mime: string; modified: number };

export const HOME = "C:\\Users\\Operator";

export function normalizePath(path: string, cwd = HOME): string {
	let p = path.trim().replace(/\//g, "\\");
	if (p === "" || p === ".") p = cwd;
	else if (p === "~") p = HOME;
	else if (/^[a-z]:\\?$/i.test(p)) p = p.slice(0, 2) + "\\";
	else if (!/^[a-z]:\\/i.test(p)) p = cwd.replace(/\\$/, "") + "\\" + p;
	const drive = p.slice(0, 2).toUpperCase();
	const parts: string[] = [];
	for (const seg of p.slice(3).split("\\")) {
		if (seg === "" || seg === ".") continue;
		if (seg === "..") parts.pop();
		else parts.push(seg);
	}
	return drive + "\\" + parts.join("\\");
}

export function parentOf(path: string): string {
	const n = normalizePath(path);
	const i = n.lastIndexOf("\\");
	return i <= 2 ? n.slice(0, 3) : n.slice(0, i);
}

export function baseName(path: string): string {
	const n = normalizePath(path);
	return n.slice(n.lastIndexOf("\\") + 1);
}

const MIMES: Record<string, string> = {
	txt: "text/plain", md: "text/markdown", json: "application/json", js: "text/javascript", ts: "text/typescript",
	py: "text/x-python", ps1: "text/x-powershell", csv: "text/csv", log: "text/plain",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
};

export function mimeFor(name: string): string {
	const ext = name.toLowerCase().split(".").pop() ?? "";
	return MIMES[ext] ?? "application/octet-stream";
}

export function isTextMime(mime: string): boolean {
	return mime.startsWith("text/") || mime === "application/json";
}

export class VirtualFs {
	root: FsNode = { kind: "dir", name: "C:", children: new Map(), modified: Date.now() };

	private walk(path: string): FsNode | undefined {
		const n = normalizePath(path);
		if (n === "C:\\") return this.root;
		let node: FsNode = this.root;
		for (const seg of n.slice(3).split("\\")) {
			if (node.kind !== "dir") return undefined;
			const next = [...node.children.values()].find((c) => c.name.toLowerCase() === seg.toLowerCase());
			if (!next) return undefined;
			node = next;
		}
		return node;
	}

	exists(path: string) { return this.walk(path) !== undefined; }
	stat(path: string) { return this.walk(path); }
	isDir(path: string) { return this.walk(path)?.kind === "dir"; }

	list(path: string): FsNode[] {
		const node = this.walk(path);
		if (!node || node.kind !== "dir") throw new Error(`Cannot find path '${normalizePath(path)}' because it does not exist.`);
		return [...node.children.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));
	}

	mkdir(path: string): void {
		const n = normalizePath(path);
		let node: FsNode = this.root;
		for (const seg of n.slice(3).split("\\")) {
			if (seg === "") continue;
			if (node.kind !== "dir") throw new Error(`'${node.name}' is a file`);
			let next = [...node.children.values()].find((c) => c.name.toLowerCase() === seg.toLowerCase());
			if (!next) {
				next = { kind: "dir", name: seg, children: new Map(), modified: Date.now() };
				node.children.set(seg.toLowerCase(), next);
			}
			node = next;
		}
	}

	read(path: string): FsNode & { kind: "file" } {
		const node = this.walk(path);
		if (!node) throw new Error(`Cannot find path '${normalizePath(path)}' because it does not exist.`);
		if (node.kind !== "file") throw new Error(`'${normalizePath(path)}' is a directory.`);
		return node;
	}

	readText(path: string): string {
		const f = this.read(path);
		return typeof f.data === "string" ? f.data : `[binary file, ${f.data.byteLength} bytes]`;
	}

	write(path: string, data: string | Uint8Array, mime?: string): void {
		const n = normalizePath(path);
		this.mkdir(parentOf(n));
		const parent = this.walk(parentOf(n));
		if (!parent || parent.kind !== "dir") throw new Error("parent is not a directory");
		const name = baseName(n);
		parent.children.set(name.toLowerCase(), { kind: "file", name, data, mime: mime ?? mimeFor(name), modified: Date.now() });
		parent.modified = Date.now();
	}

	remove(path: string): void {
		const n = normalizePath(path);
		const parent = this.walk(parentOf(n));
		if (!parent || parent.kind !== "dir" || !parent.children.has(baseName(n).toLowerCase())) {
			throw new Error(`Cannot find path '${n}' because it does not exist.`);
		}
		parent.children.delete(baseName(n).toLowerCase());
	}
}

const INSPECTION_REPORT = `MANGALORE REFINERY AND PETROCHEMICALS LIMITED
Inspection Report  NRC/RVF/INSP/2026-0417
Unit: Crude Distillation Unit 2 (CDU-2)     Date of inspection: 17 April 2026
Inspector: R. Nayak, Inspection Engineer     Reviewed: S. Kamath, Section Head

SECTION 1 - SCOPE
Routine external visual inspection and ultrasonic thickness survey of the E-1104A
shell-and-tube exchanger and the associated relief line, per the CDU-2 inspection plan.

SECTION 2 - THICKNESS SURVEY (mm)
CML 01   11.42   nominal 12.70   t-min 6.90
CML 02   11.08   nominal 12.70   t-min 6.90
CML 03   12.91   nominal 12.70   t-min 6.90
CML 04   13.05   nominal 12.70   t-min 6.90
CML 05    9.84   nominal 12.70   t-min 6.90
CML 06    7.20   nominal  9.50   t-min 6.90

SECTION 3 - FINDINGS
3.1  E-1104A - Insulation cladding open at the channel end over a run of about 1.2 m.
     Corrosion under insulation (CUI) suspected. Severity: MAJOR.
     Recommended action: strip cladding and UT scan before restart.
3.2  PSV-2207A - Relief-valve test tag expired 04-2026. No current bench certificate
     is held against this tag in the register. Severity: MAJOR.
     Recommended action: withdraw and bench test; fit spare from stores.
3.3  Line 6in-P-2207-A1 - Minor surface pitting at support S-14, wall loss within
     allowance. Severity: MINOR. Monitor at next survey.

SECTION 4 - CONCLUSION
Two Major findings (3.1, 3.2) are open. A non-conformance report is to be raised
against PSV-2207A, and the exchanger is not to be returned to service until the
UT scan at the channel end is complete and reviewed.
`;

const VENDOR_NOTE = `Vendor thread - Bharat Valves & Fittings (WhatsApp, exported 2 Sep 2026)
[Quotation for PSV-2207A spare - QT/BVF/2026/1183]
Delivery ex-stock, 3 working days. Bench certificate supplied with the valve.
Note: this file is a local export. The workstation does not open the live thread.
`;

/** Build the seeded workstation. */
export function seedFs(): VirtualFs {
	const fs = new VirtualFs();
	for (const d of ["Desktop", "Documents", "Pictures", "Downloads", "Documents\\Inspection reports", "Documents\\Deliverables", "Documents\\Vendor correspondence"]) {
		fs.mkdir(`${HOME}\\${d}`);
	}
	fs.mkdir("C:\\Windows\\System32");
	fs.mkdir("C:\\Program Files\\Faraday");
	fs.write(`${HOME}\\Documents\\Inspection reports\\NRC-RVF-INSP-2026-0417.txt`, INSPECTION_REPORT);
	fs.write(`${HOME}\\Documents\\Vendor correspondence\\PSV-2207A quotation.txt`, VENDOR_NOTE);
	fs.write(
		`${HOME}\\Documents\\README.txt`,
		"MRPL Workstation - operator account.\r\n\r\nFaraday is installed under Program Files. Inspection reports are under Documents\\Inspection reports.\r\nDeliverables Faraday produces are written to Documents\\Deliverables.\r\n",
	);
	fs.write(
		"C:\\Program Files\\Faraday\\ABOUT.txt",
		"Faraday - a sovereign industrial knowledge-work workbench.\r\nThis deployable build reaches hosted Claude models through Anthropic's API; the product itself runs open-weight models offline.\r\n",
	);
	return fs;
}
