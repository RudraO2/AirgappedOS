/**
 * Ready-made material for a first visit: prompts that walk the demo path, and
 * sample images for the attach menu (two public P&IDs from Wikimedia Commons,
 * CC BY-SA 3.0 — see public/samples/CREDITS.txt — and a rendered nameplate).
 */
import type { PendingImage } from "./store";

export interface SampleImage {
	id: string;
	label: string;
	hint: string;
	/** Bundled file, or "nameplate" for the drawn one. */
	source: string;
	mediaType: "image/png" | "image/jpeg";
}

export const SAMPLE_IMAGES: SampleImage[] = [
	{ id: "pid-pump-tank", label: "Sample P&ID — pump and tank", hint: "A small, clean P&ID: one tank, one pump, instruments and valves", source: "/samples/pid-pump-tank.png", mediaType: "image/png" },
	{ id: "pid-process-unit", label: "Sample P&ID — process unit", hint: "A denser process P&ID with numbered equipment and instrument loops", source: "/samples/pid-process-unit.jpg", mediaType: "image/jpeg" },
	{ id: "nameplate", label: "Sample photo — relief valve nameplate", hint: "PSV-2207A, set pressure and test date", source: "nameplate", mediaType: "image/png" },
];

export interface SuggestedPrompt {
	label: string;
	text: string;
	image?: string;
}

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
	{ label: "Try to reach the internet", text: "Open WhatsApp in the browser and check the vendor thread." },
	{ label: "Read the inspection report", text: "Summarise the key findings in the inspection report NRC/RVF/INSP/2026-0417." },
	{ label: "Read a nameplate", text: "What does this nameplate say? Is the test tag still valid?", image: "nameplate" },
	{ label: "Tag inventory from a P&ID", text: "Give me the tag and symbol inventory for this P&ID: equipment, instruments, valves and line numbers.", image: "pid-pump-tank" },
	{ label: "Run a calculation", text: "Convert a set pressure of 18.5 barg to kPa gauge, rounded to the nearest whole number, using a script in the terminal." },
	{ label: "Produce the approval note", text: "Generate the approval note for the PSV-2207A non-conformance, citing the inspection report NRC/RVF/INSP/2026-0417." },
];

const MAX_EDGE = 1568;

async function bitmapToPending(bitmap: ImageBitmap, mediaType: "image/png" | "image/jpeg"): Promise<PendingImage> {
	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	const g = canvas.getContext("2d")!;
	if (mediaType === "image/jpeg") {
		g.fillStyle = "#ffffff";
		g.fillRect(0, 0, canvas.width, canvas.height);
	}
	g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	const url = canvas.toDataURL(mediaType, 0.9);
	return { url, mediaType, base64: url.slice(url.indexOf(",") + 1) };
}

/** Resize an operator's file to the model's budget and return base64 + a preview URL. */
export async function prepareImageFile(file: File): Promise<PendingImage> {
	const bitmap = await createImageBitmap(file);
	const mediaType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
	return bitmapToPending(bitmap, mediaType);
}

function drawNameplate(): PendingImage {
	const c = document.createElement("canvas");
	c.width = 900;
	c.height = 520;
	const g = c.getContext("2d")!;
	// brushed plate
	const grad = g.createLinearGradient(0, 0, 900, 520);
	grad.addColorStop(0, "#c9c9c2");
	grad.addColorStop(0.5, "#b3b3ac");
	grad.addColorStop(1, "#c4c4bd");
	g.fillStyle = grad;
	g.fillRect(0, 0, 900, 520);
	g.strokeStyle = "#3b3b3b";
	g.lineWidth = 8;
	g.strokeRect(24, 24, 852, 472);
	for (const [x, y] of [[52, 52], [848, 52], [52, 468], [848, 468]]) {
		g.beginPath();
		g.arc(x, y, 11, 0, Math.PI * 2);
		g.fillStyle = "#6e6e6e";
		g.fill();
	}
	g.fillStyle = "#141414";
	g.font = "bold 40px Arial";
	g.fillText("PRESSURE SAFETY VALVE", 90, 112);
	g.font = "22px Arial";
	g.fillText("BHARAT VALVES & FITTINGS · MANGALURU", 90, 148);
	g.font = "30px Arial";
	const rows: Array<[string, string]> = [
		["TAG", "PSV-2207A"],
		["SET PRESSURE", "18.5 barg"],
		["ORIFICE / INLET", "J  /  3 in"],
		["SERIAL", "BVF-19-04471"],
		["LAST BENCH TEST", "04-2026"],
		["NEXT TEST DUE", "04-2027"],
	];
	let y = 210;
	for (const [k, v] of rows) {
		g.fillStyle = "#333";
		g.fillText(k, 90, y);
		g.fillStyle = "#101010";
		g.font = "bold 30px Arial";
		g.fillText(v, 470, y);
		g.font = "30px Arial";
		y += 50;
	}
	const url = c.toDataURL("image/png");
	return { url, mediaType: "image/png", base64: url.slice(url.indexOf(",") + 1) };
}

export async function loadSample(id: string): Promise<PendingImage> {
	const sample = SAMPLE_IMAGES.find((s) => s.id === id);
	if (!sample) throw new Error(`no sample "${id}"`);
	if (sample.source === "nameplate") return drawNameplate();
	const blob = await (await fetch(sample.source)).blob();
	const bitmap = await createImageBitmap(blob);
	return bitmapToPending(bitmap, sample.mediaType);
}
