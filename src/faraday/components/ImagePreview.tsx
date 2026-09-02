import { useEffect } from "react";
import { useFaraday } from "../store";

/** A preview of an attached image, inside the Faraday window: big enough to read, not full screen. */
export function ImagePreview() {
	const url = useFaraday((s) => s.previewImage);
	const setPreviewImage = useFaraday((s) => s.setPreviewImage);
	useEffect(() => {
		if (!url) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setPreviewImage(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [url, setPreviewImage]);
	if (!url) return null;
	return (
		<div
			role="dialog"
			aria-label="Attached image preview"
			className="fade-in"
			onClick={() => setPreviewImage(null)}
			style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 32 }}
		>
			<div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90%", maxHeight: "90%", display: "flex", flexDirection: "column", background: "var(--bg-layer-1)", borderRadius: 12, padding: 10, boxShadow: "var(--shadow-window)", border: "1px solid var(--border-l2)" }}>
				<img src={url} alt="Attached image" style={{ display: "block", flex: "1 1 auto", minHeight: 0, maxWidth: "100%", objectFit: "contain", borderRadius: 6, background: "#ffffff" }} />
				<button
					onClick={() => setPreviewImage(null)}
					aria-label="Close preview"
					title="Close (Esc)"
					style={{ position: "absolute", top: -12, right: -12, width: 28, height: 28, borderRadius: "50%", background: "var(--label-primary)", color: "var(--bg-layer-1)", fontSize: 16, lineHeight: 1, display: "grid", placeItems: "center", boxShadow: "var(--shadow-lv2)" }}
				>
					×
				</button>
				<div style={{ fontSize: 11.5, color: "var(--label-tertiary)", textAlign: "center", marginTop: 6 }}>Attached image · sent to the vision member as pixels · click outside or press Esc to close</div>
			</div>
		</div>
	);
}
