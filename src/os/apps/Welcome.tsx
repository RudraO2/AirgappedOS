import type { AppProps } from "../kernel/apps";
import { launch } from "../kernel/launch";
import { useOS } from "../kernel/store";
import { AppIcon } from "../shell/Icon";

const LOCAL_REPO = "https://github.com/RudraO2/Faraday";

/** The first-run notice: short enough to be read, one button. */
export function Welcome({ windowId }: AppProps) {
	const closeWindow = useOS((s) => s.closeWindow);
	return (
		<div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 26px 20px", fontSize: 14, lineHeight: 1.55 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
				<AppIcon app="faraday" size={40} />
				<div>
					<div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Faraday — demo build</div>
					<div style={{ color: "var(--label-secondary)", fontSize: 12 }}>SIH26117 · Mangalore Refinery and Petrochemicals Limited</div>
				</div>
			</div>
			<p style={{ margin: "0 0 8px" }}>
				<strong>This link is a simulation.</strong> A Windows-style workstation in your browser, with Faraday answering through <strong>hosted open-weight models via the Groq API</strong> — the only way a public link can answer.
			</p>
			<p style={{ margin: "0 0 8px" }}>
				<strong>The real product is air-gapped:</strong> open-weight models on the operator's own GPU, nothing leaves the machine. The router, the seal's refusals and record, and the signed <code>.docx</code> are the same code.
			</p>
			<p style={{ margin: 0, fontSize: 12.5, color: "var(--label-secondary)" }}>
				Run the real one locally:{" "}
				<button
					onClick={() => {
						closeWindow(windowId);
						launch("browser", { url: LOCAL_REPO });
					}}
					style={{ color: "var(--accent)", textDecoration: "underline" }}
				>
					github.com/RudraO2/Faraday
				</button>
			</p>
			<div style={{ flex: 1 }} />
			<div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
				<button
					autoFocus
					onClick={() => {
						closeWindow(windowId);
						launch("faraday", { tour: true });
					}}
					style={{ padding: "10px 28px", borderRadius: 6, background: "var(--accent)", color: "var(--accent-label)", fontWeight: 600, fontSize: 14 }}
				>
					Open Faraday
				</button>
			</div>
		</div>
	);
}
