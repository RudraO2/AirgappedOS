import { useFaraday } from "../store";

/**
 * The mark inside a ring that reads the seal: hairline when sealed, dashed
 * warning when open. Decoration in the strict sense — no title, no click.
 */
export function RingedMark({ size = 24 }: { size?: number }) {
	const sealed = useFaraday((s) => s.sealed);
	const edge = Math.round(size * 0.62);
	return (
		<span aria-hidden style={{ position: "relative", width: size, height: size, display: "inline-grid", placeItems: "center", flex: "0 0 auto" }}>
			<span
				style={{
					position: "absolute",
					inset: 0,
					borderRadius: "50%",
					border: sealed ? "1px solid var(--border-l3)" : "1.5px dashed var(--warn-primary)",
				}}
			/>
			<img src="/favicon.svg" alt="" className="mark" style={{ width: edge, height: edge }} draggable={false} />
		</span>
	);
}

export function Wordmark() {
	return <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.01em" }}>Faraday</span>;
}

export function Hero() {
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: "0.4em", fontSize: 30 }}>
			<RingedMark size={40} />
			<span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.05 }}>
				<span style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>Faraday</span>
				<span style={{ fontSize: "0.34em", fontWeight: 400, letterSpacing: "0.04em", color: "var(--label-secondary)" }}>Into the Unknown</span>
			</span>
			<span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)", alignSelf: "center", marginLeft: 4 }}>
				Preview
			</span>
		</span>
	);
}
