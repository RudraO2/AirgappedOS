import { useEffect, useState } from "react";
import type { AppProps } from "../kernel/apps";
import { HOME_URL, useBrowser } from "../kernel/browser";
import { useOS } from "../kernel/store";

export function Browser({ windowId, nonce }: AppProps) {
	const { tabs, active, openTab, closeTab, setActive, navigate, back, forward, reload } = useBrowser();
	const setTitle = useOS((s) => s.setTitle);
	const tab = tabs.find((t) => t.id === active) ?? null;
	const [address, setAddress] = useState(tab?.url === HOME_URL ? "" : (tab?.url ?? ""));

	useEffect(() => {
		if (tabs.length === 0) openTab();
	}, [tabs.length, openTab, nonce]);
	useEffect(() => {
		setAddress(tab?.url === HOME_URL ? "" : (tab?.url ?? ""));
	}, [tab?.url, tab?.loadedAt]);
	useEffect(() => {
		setTitle(windowId, `${tab?.title ?? "New tab"} - Browser`);
	}, [tab?.title, windowId, setTitle]);

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div style={{ display: "flex", alignItems: "flex-end", gap: 2, padding: "6px 8px 0", background: "var(--bg-layer-2)" }}>
				{tabs.map((t) => (
					<div
						key={t.id}
						onClick={() => setActive(t.id)}
						role="tab"
						aria-selected={t.id === active}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							maxWidth: 200,
							minWidth: 120,
							padding: "7px 8px 7px 12px",
							borderRadius: "8px 8px 0 0",
							background: t.id === active ? "var(--bg-layer-1)" : "transparent",
							border: t.id === active ? "1px solid var(--border-l1)" : "1px solid transparent",
							borderBottom: "none",
							fontSize: 12,
							cursor: "default",
						}}
					>
						<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
						<button
							aria-label="Close tab"
							onClick={(e) => {
								e.stopPropagation();
								closeTab(t.id);
							}}
							style={{ width: 18, height: 18, borderRadius: 4, color: "var(--label-tertiary)" }}
						>
							×
						</button>
					</div>
				))}
				<button aria-label="New tab" onClick={() => openTab()} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 16, color: "var(--label-secondary)" }}>
					+
				</button>
			</div>
			<div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", borderBottom: "1px solid var(--border-l1)", background: "var(--bg-layer-1)" }}>
				<Nav label="Back" onClick={() => tab && back(tab.id)} disabled={!tab || tab.index === 0}>‹</Nav>
				<Nav label="Forward" onClick={() => tab && forward(tab.id)} disabled={!tab || tab.index >= tab.history.length - 1}>›</Nav>
				<Nav label="Reload" onClick={() => tab && reload(tab.id)} disabled={!tab}>↻</Nav>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (tab) navigate(tab.id, address);
					}}
					style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-l2)", borderRadius: 999, background: "var(--bg-layer-2)", padding: "5px 12px" }}
				>
					<span aria-hidden style={{ color: "var(--label-tertiary)", fontSize: 12 }}>
						{tab?.url.startsWith("https:") ? "🔒" : "○"}
					</span>
					<input
						aria-label="Address"
						value={address}
						placeholder="Search or enter web address"
						onChange={(e) => setAddress(e.target.value)}
						onFocus={(e) => e.currentTarget.select()}
						style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13 }}
					/>
				</form>
			</div>
			<div style={{ flex: 1, minHeight: 0, background: "#fff", position: "relative" }}>
				{tab && tab.url === HOME_URL && <HomePage onGo={(u) => navigate(tab.id, u)} />}
				{tab && tab.url !== HOME_URL && (
					<iframe
						key={`${tab.id}-${tab.loadedAt}`}
						title={tab.title}
						src={tab.url}
						sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
						referrerPolicy="no-referrer"
						style={{ width: "100%", height: "100%", border: "none", display: "block", background: "#fff" }}
					/>
				)}
			</div>
		</div>
	);
}

function Nav({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
	return (
		<button aria-label={label} title={label} onClick={onClick} disabled={disabled} style={{ width: 30, height: 30, borderRadius: 6, fontSize: 17, color: disabled ? "var(--label-tertiary)" : "var(--label-primary)" }}>
			{children}
		</button>
	);
}

function HomePage({ onGo }: { onGo: (url: string) => void }) {
	const [q, setQ] = useState("");
	return (
		<div style={{ height: "100%", background: "var(--bg-layer-2)", color: "var(--label-primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
			<div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>New tab</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onGo(q);
				}}
				style={{ width: "min(560px, 100%)", display: "flex", border: "1px solid var(--border-l2)", borderRadius: 999, background: "var(--bg-layer-1)", padding: "10px 18px", boxShadow: "var(--shadow-lv2)" }}
			>
				<input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the web or type a URL" aria-label="Search or URL" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 15 }} />
			</form>
			<div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
				{[
					["example.com", "https://example.com"],
					["Wikipedia", "https://en.wikipedia.org"],
					["MDN", "https://developer.mozilla.org"],
				].map(([label, url]) => (
					<button key={url} onClick={() => onGo(url)} style={{ padding: "10px 16px", borderRadius: 8, background: "var(--bg-layer-1)", border: "1px solid var(--border-l1)", fontSize: 12 }}>
						{label}
					</button>
				))}
			</div>
			<div style={{ fontSize: 11, color: "var(--label-tertiary)", maxWidth: 520, textAlign: "center", lineHeight: 1.5 }}>
				This browser shows pages inside a frame. Some sites refuse to be framed and show a blank page; the request still leaves this machine.
			</div>
		</div>
	);
}
