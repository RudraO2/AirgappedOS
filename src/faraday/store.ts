import type Anthropic from "@anthropic-ai/sdk";
import { create } from "zustand";
import { isSealed, SEAL_EVENT, setSealed } from "./lib/egress/seal.js";

export type Block =
	| { type: "text"; text: string }
	| { type: "thinking"; text: string }
	| {
			type: "tool";
			id: string;
			name: string;
			input: Record<string, unknown>;
			status: "running" | "done" | "denied" | "error";
			result?: string;
			produced?: { path: string; name: string };
	  };

export type Turn =
	| { id: number; role: "user"; text: string; image?: { url: string; mediaType: string } }
	| { id: number; role: "assistant"; blocks: Block[]; member?: string; error?: string; done: boolean };

export interface SessionEvent {
	seq: number;
	type: string;
	time: number;
	data: Record<string, unknown>;
}

export interface RoutingDecision {
	taskType: string;
	scored: Array<{ name: string; score: number; matched: Array<{ capability: string; points: number }>; modalities: string[]; capabilities: string[] }>;
	excluded: Array<{ name: string; reason: { code: string; detail: string } }>;
	selected: string | null;
	tied: boolean;
	allZero: boolean;
}

export interface Session {
	id: string;
	title: string;
	createdAt: number;
	turns: Turn[];
	api: Anthropic.MessageParam[];
	events: SessionEvent[];
	routing: RoutingDecision | null;
	seq: number;
}

export interface PendingImage {
	url: string;
	mediaType: string;
	base64: string;
}

interface FaradayState {
	sessions: Session[];
	currentId: string;
	sealed: boolean;
	sealBusy: boolean;
	drawerOpen: boolean;
	drawerWidth: number;
	busy: boolean;
	pendingImage: PendingImage | null;
	previewImage: string | null;
	lastDenial: { seq: number; tool: string; target: string; at: number } | null;
	current(): Session;
	newSession(): void;
	selectSession(id: string): void;
	updateSession(id: string, fn: (s: Session) => Partial<Session>): void;
	appendEvent(type: string, data: Record<string, unknown>): SessionEvent;
	requestSeal(open: boolean): void;
	setDrawerOpen(v: boolean): void;
	toggleDrawer(): void;
	setDrawerWidth(px: number): void;
	setBusy(v: boolean): void;
	setPendingImage(img: PendingImage | null): void;
	setPreviewImage(url: string | null): void;
	clearDenial(): void;
}

export const DRAWER_MIN_WIDTH = 300;
export const DRAWER_MAX_WIDTH = 720;
export const DRAWER_DEFAULT_WIDTH = 380;

let sessionCounter = 0;
let turnCounter = 0;

export function nextTurnId() {
	return ++turnCounter;
}

function makeSession(): Session {
	sessionCounter += 1;
	return { id: `session-${Date.now().toString(36)}-${sessionCounter}`, title: "New Session", createdAt: Date.now(), turns: [], api: [], events: [], routing: null, seq: 0 };
}

const savedWidth = (() => {
	try {
		const v = Number(localStorage.getItem("faraday.sovereignty.width"));
		if (Number.isFinite(v) && v >= DRAWER_MIN_WIDTH && v <= DRAWER_MAX_WIDTH) return v;
	} catch {
		/* storage blocked */
	}
	return DRAWER_DEFAULT_WIDTH;
})();

const first = makeSession();

export const useFaraday = create<FaradayState>((set, get) => ({
	sessions: [first],
	currentId: first.id,
	sealed: isSealed(),
	sealBusy: false,
	drawerOpen: false,
	drawerWidth: savedWidth,
	busy: false,
	pendingImage: null,
	previewImage: null,
	lastDenial: null,
	current: () => {
		const s = get();
		return s.sessions.find((x) => x.id === s.currentId) ?? s.sessions[0];
	},
	newSession: () => {
		const cur = get().current();
		if (cur.turns.length === 0) return;
		const s = makeSession();
		set((st) => ({ sessions: [s, ...st.sessions], currentId: s.id, pendingImage: null }));
	},
	selectSession: (id) => set({ currentId: id }),
	updateSession: (id, fn) =>
		set((st) => ({ sessions: st.sessions.map((s) => (s.id === id ? { ...s, ...fn(s) } : s)) })),
	appendEvent: (type, data) => {
		const cur = get().current();
		const event: SessionEvent = { seq: cur.seq + 1, type, time: Date.now(), data };
		get().updateSession(cur.id, (s) => ({ events: [...s.events, event], seq: s.seq + 1 }));
		if (type === "egress/denied") {
			set({ lastDenial: { seq: event.seq, tool: String(data.tool ?? "a tool"), target: String(data.target ?? "an unrecorded target"), at: event.time } });
		}
		return event;
	},
	requestSeal: (open) => {
		// Recorded even when nothing changed: an operator pressing "close" on an
		// already-closed seal is a real thing they did.
		const before = isSealed();
		const wanted = !open;
		setSealed(wanted);
		set({ sealed: isSealed(), sealBusy: false });
		get().appendEvent(SEAL_EVENT, { sealed: wanted, changed: before !== wanted });
	},
	setDrawerOpen: (v) => set({ drawerOpen: v }),
	toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
	setDrawerWidth: (px) => {
		const w = Math.max(DRAWER_MIN_WIDTH, Math.min(DRAWER_MAX_WIDTH, Math.round(px)));
		try {
			localStorage.setItem("faraday.sovereignty.width", String(w));
		} catch {
			/* storage blocked */
		}
		set({ drawerWidth: w });
	},
	setBusy: (v) => set({ busy: v }),
	setPendingImage: (img) => set({ pendingImage: img }),
	setPreviewImage: (url) => set({ previewImage: url }),
	clearDenial: () => set({ lastDenial: null }),
}));

/** The egress view: counts are counted from events, never stored. */
export function egressSnapshot(session: Session) {
	const entries = session.events
		.filter((e) => e.type.startsWith("egress/"))
		.map((e) => ({ ...e, kind: e.type.slice("egress/".length) }));
	return {
		count: entries.filter((e) => e.kind === "denied").length,
		permitted: entries.filter((e) => e.kind === "permitted").length,
		entries,
		latest: entries[entries.length - 1] ?? null,
	};
}

export const faraday = { get: () => useFaraday.getState() };
