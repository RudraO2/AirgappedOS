import type { AppProps } from "../os/kernel/apps";
import { launch } from "../os/kernel/launch";
import { Hero, RingedMark, Wordmark } from "./components/Brand";
import { Composer } from "./components/Composer";
import { Overlays } from "./components/SealBand";
import { SealRow } from "./components/SealRow";
import { SovereigntyDrawer } from "./components/SovereigntyDrawer";
import { Transcript } from "./components/Transcript";
import { Pill, StateDot } from "./components/ui";
import { egressSnapshot, useFaraday } from "./store";

export function Faraday(_: AppProps) {
	const sessions = useFaraday((s) => s.sessions);
	const currentId = useFaraday((s) => s.currentId);
	const selectSession = useFaraday((s) => s.selectSession);
	const newSession = useFaraday((s) => s.newSession);
	const drawerOpen = useFaraday((s) => s.drawerOpen);
	const drawerWidth = useFaraday((s) => s.drawerWidth);
	const session = useFaraday((s) => s.current());
	const hero = session.turns.length === 0;
	const egress = egressSnapshot(session);

	return (
		<div style={{ position: "absolute", inset: 0, display: "flex", background: "var(--bg-layer-1)", color: "var(--label-primary)", fontSize: 13 }}>
			<aside style={{ width: 280, flex: "0 0 auto", borderRight: "1px solid var(--border-l1)", background: "var(--bg-layer-2)", display: "flex", flexDirection: "column", padding: 14 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px 14px" }}>
					<RingedMark size={26} />
					<Wordmark />
				</div>
				<button
					onClick={newSession}
					style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 38, borderRadius: 8, background: "var(--bg-layer-3)", border: "1px solid var(--border-l1)", fontWeight: 600, fontSize: 13 }}
				>
					<span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Session
				</button>
				<div style={{ ...{ color: "var(--label-secondary)", fontSize: 12, padding: "18px 4px 8px" } }}>Workspaces</div>
				<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 13 }}>
					<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M1.5 4a1 1 0 0 1 1-1h3.2l1.5 1.5h6.3a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="none" stroke="var(--accent)" strokeWidth="1.2" /></svg>
					Blind Flange
				</div>
				<div className="scroll" style={{ flex: 1, overflowY: "auto", paddingLeft: 12 }}>
					{sessions.map((s) => (
						<button
							key={s.id}
							onClick={() => selectSession(s.id)}
							style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", borderRadius: 6, background: s.id === currentId ? "var(--selector)" : "transparent", textAlign: "left", fontSize: 13 }}
							onPointerEnter={(e) => (e.currentTarget.style.background = "var(--interactive-hover)")}
							onPointerLeave={(e) => (e.currentTarget.style.background = s.id === currentId ? "var(--selector)" : "transparent")}
						>
							<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
							<span style={{ color: "var(--label-tertiary)", fontSize: 11 }}>{ago(s.createdAt)}</span>
						</button>
					))}
				</div>
				<SealRow />
				<button onClick={() => launch("settings")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 6px 2px", fontSize: 13, color: "var(--label-primary)" }}>
					<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M8 1.5l1.3 1.1 1.7-.3.7 1.6 1.6.7-.3 1.7L14.5 8l-1.1 1.3.3 1.7-1.6.7-.7 1.6-1.7-.3L8 14.5l-1.3-1.1-1.7.3-.7-1.6-1.6-.7.3-1.7L1.5 8l1.1-1.3-.3-1.7 1.6-.7.7-1.6 1.7.3z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>
					Settings
				</button>
			</aside>

			<main style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", flexDirection: "column", paddingRight: drawerOpen ? drawerWidth : 0, transition: "padding-right 120ms ease" }}>
				<Overlays />
				{!hero && (
					<header style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border-l1)" }}>
						<span style={{ fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</span>
						<ProviderPill />
						<Pill title="Outbound attempts denied and recorded this session, counted from the session log.">
							<StateDot state={egress.count > 0 ? "error" : "done"} size={8} />
							Egress {egress.count}
						</Pill>
					</header>
				)}
				{hero ? (
					<div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 24 }}>
						<Hero />
						<div style={{ width: "100%", maxWidth: 780, display: "flex", alignItems: "center", gap: 14, fontSize: 14, color: "var(--label-primary)", paddingLeft: 6 }}>
							<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
								<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M1.5 4a1 1 0 0 1 1-1h3.2l1.5 1.5h6.3a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
								Blind Flange
							</span>
							<span title="Task type, selected by the router. Faraday classifies the request; there is nothing here to set." style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
								<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 12.5c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
								Document
							</span>
							<span style={{ marginLeft: "auto" }}>
								<ProviderPill />
							</span>
						</div>
						<Composer hero />
					</div>
				) : (
					<>
						<Transcript turns={session.turns} />
						<div style={{ padding: "0 24px 16px" }}>
							<Composer hero={false} />
						</div>
					</>
				)}
				<SovereigntyDrawer />
			</main>
		</div>
	);
}

function ProviderPill() {
	return (
		<Pill title="Faraday is answering from the hosted provider: Claude models reached through Anthropic's API. This is the deployable build; the product itself runs open-weight models locally and offline, and says so up front.">
			<StateDot state="done" size={8} />
			Hosted — Anthropic API
		</Pill>
	);
}

function ago(at: number) {
	const s = Math.max(0, Math.round((Date.now() - at) / 1000));
	if (s < 60) return "now";
	if (s < 3600) return `${Math.round(s / 60)}min`;
	if (s < 86400) return `${Math.round(s / 3600)}h`;
	return `${Math.round(s / 86400)}d`;
}
