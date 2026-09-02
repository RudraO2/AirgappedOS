import type { AppProps } from "../kernel/apps";
import { launch } from "../kernel/launch";
import { useOS } from "../kernel/store";
import { AppIcon } from "../shell/Icon";

/** The first-run notice: what this link is, and what it is not. Up front, not buried. */
export function Welcome({ windowId }: AppProps) {
	const closeWindow = useOS((s) => s.closeWindow);
	return (
		<div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "28px 32px", fontSize: 14, lineHeight: 1.6 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
				<AppIcon app="faraday" size={44} />
				<div>
					<div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>What you are looking at</div>
					<div style={{ color: "var(--label-secondary)", fontSize: 13 }}>Faraday · SIH26117 · Mangalore Refinery and Petrochemicals Limited</div>
				</div>
			</div>
			<p style={{ margin: "0 0 12px" }}>
				This link runs <strong>Faraday</strong> inside a simulated Windows-style workstation in your browser. The models behind it are{" "}
				<strong>Claude Haiku 4.5 and Claude Sonnet 5, reached through Anthropic's API</strong> — closed-weight, hosted — because that is the only way a public link can answer at all.
			</p>
			<p style={{ margin: "0 0 12px" }}>
				The real product runs <strong>open-weight models on the operator's own GPU, fully offline</strong>; the recorded local run is that proof.
			</p>
			<p style={{ margin: "0 0 12px" }}>
				Everything else here is the same code path: the router really classifies and scores, the seal really refuses the workbench's outbound tool calls before they run and records each one, and the approval note is a real <code>.docx</code>. What is simulated is the fleet and the machine — and this notice says so up front.
			</p>
			<div style={{ borderTop: "1px solid var(--border-l1)", margin: "18px 0 14px" }} />
			<div style={{ fontSize: 13, color: "var(--label-secondary)" }}>
				Try, in order: ask Faraday to open a website · open the Sovereignty drawer and throw the seal · attach a photograph and ask about it · ask for a calculation · ask for the approval note.
			</div>
			<div style={{ display: "flex", gap: 10, marginTop: 22 }}>
				<button
					onClick={() => {
						closeWindow(windowId);
						launch("faraday");
					}}
					style={{ padding: "8px 16px", borderRadius: 6, background: "var(--accent)", color: "var(--accent-label)", fontWeight: 600 }}
				>
					Open Faraday
				</button>
				<button onClick={() => closeWindow(windowId)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border-l2)" }}>
					Close
				</button>
			</div>
		</div>
	);
}
