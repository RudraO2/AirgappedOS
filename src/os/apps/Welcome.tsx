import type { AppProps } from "../kernel/apps";
import { launch } from "../kernel/launch";
import { useOS } from "../kernel/store";
import { AppIcon } from "../shell/Icon";

const LOCAL_REPO = "https://github.com/RudraO2/blind-flange";

/** The first-run notice: what this link is, what it is not, and how to run the real thing. */
export function Welcome({ windowId }: AppProps) {
	const closeWindow = useOS((s) => s.closeWindow);
	const openBrowser = (url: string) => {
		closeWindow(windowId);
		launch("browser", { url });
	};
	return (
		<div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "24px 28px", fontSize: 13.5, lineHeight: 1.55 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
				<AppIcon app="faraday" size={40} />
				<div>
					<div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Faraday — demo build</div>
					<div style={{ color: "var(--label-secondary)", fontSize: 12 }}>SIH26117 · Mangalore Refinery and Petrochemicals Limited</div>
				</div>
			</div>
			<p style={{ margin: "0 0 10px" }}>
				<strong>This link is a simulation.</strong> A Windows-style workstation in your browser, with Faraday running inside it on <strong>hosted Claude models (Haiku 4.5, Sonnet 5) through Anthropic's API</strong> — the only way a public link can answer.
			</p>
			<p style={{ margin: "0 0 10px" }}>
				<strong>The real product is air-gapped.</strong> Open-weight models on the operator's own GPU, nothing leaves the machine. The router, the seal's refusals and record, and the signed <code>.docx</code> here are the same code; only the fleet and the machine are simulated.
			</p>
			<div style={{ borderTop: "1px solid var(--border-l1)", margin: "14px 0 12px" }} />
			<div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Run the real one locally</div>
			<div style={{ fontSize: 12.5, color: "var(--label-secondary)", display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, rowGap: 3 }}>
				<span>Source</span>
				<button onClick={() => openBrowser(LOCAL_REPO)} style={{ color: "var(--accent)", textAlign: "left", textDecoration: "underline" }}>
					github.com/RudraO2/blind-flange
				</button>
				<span>OS</span>
				<span>Windows 10/11, 64-bit</span>
				<span>GPU</span>
				<span>NVIDIA with 4 GB VRAM (built and measured on a GTX 1650 Max-Q, Vulkan — no CUDA needed)</span>
				<span>RAM / disk</span>
				<span>16 GB RAM · ~4 GB for the two Qwen models (Apache-2.0), fetched once</span>
				<span>Toolchain</span>
				<span>Node 22.15+, pnpm 10.11+</span>
				<span>Start</span>
				<span>
					<code>git clone</code> the repo, double-click <code>run.bat</code>. It installs the runtime (llama-swap + llama.cpp), downloads the models, and opens the workbench at <code>127.0.0.1:3080</code>.
				</span>
			</div>
			<div style={{ display: "flex", gap: 10, marginTop: 18 }}>
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
