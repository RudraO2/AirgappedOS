import { useEffect, useRef, useState } from "react";
import { useFaraday } from "../store";
import { runTurn } from "../turn";
import { RoutingChip } from "./RoutingChip";

const ATTACH_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_EDGE = 640;

/** Resize to the prototype's measured 640×640 budget and return base64 + a preview URL. */
async function prepareImage(file: File): Promise<{ base64: string; mediaType: string; url: string }> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	const mediaType = file.type === "image/png" || file.type === "image/gif" ? "image/png" : "image/jpeg";
	const url = canvas.toDataURL(mediaType, 0.88);
	return { base64: url.slice(url.indexOf(",") + 1), mediaType, url };
}

export function Composer({ hero }: { hero: boolean }) {
	const busy = useFaraday((s) => s.busy);
	const pendingImage = useFaraday((s) => s.pendingImage);
	const setPendingImage = useFaraday((s) => s.setPendingImage);
	const [text, setText] = useState("");
	const [menuOpen, setMenuOpen] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const areaRef = useRef<HTMLTextAreaElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onDown = (e: PointerEvent) => {
			if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
		};
		window.addEventListener("pointerdown", onDown);
		return () => window.removeEventListener("pointerdown", onDown);
	}, [menuOpen]);

	const attach = async (file: File | null | undefined) => {
		if (!file || !ATTACH_ACCEPT.split(",").includes(file.type)) return;
		setPendingImage(await prepareImage(file));
	};

	const send = () => {
		const t = text.trim();
		if (t === "" || busy) return;
		setText("");
		void runTurn(t, pendingImage ?? undefined);
	};

	return (
		<div
			onPaste={(e) => {
				const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
				if (item) {
					e.preventDefault();
					void attach(item.getAsFile());
				}
			}}
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => {
				e.preventDefault();
				void attach(e.dataTransfer.files[0]);
			}}
			style={{
				width: "100%",
				maxWidth: hero ? 780 : "min(880px, 100%)",
				margin: "0 auto",
				border: "1px solid var(--border-l2)",
				borderRadius: 20,
				background: "var(--bg-layer-1)",
				boxShadow: "var(--shadow-lv2)",
				padding: "12px 12px 10px",
			}}
		>
			{pendingImage && (
				<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
					<img src={pendingImage.url} alt="Attached image" style={{ height: 56, borderRadius: 6, border: "1px solid var(--border-l1)" }} />
					<span style={{ fontSize: 12, color: "var(--label-secondary)" }}>Attached image — goes to the vision member as pixels.</span>
					<button onClick={() => setPendingImage(null)} aria-label="Remove the attached image" style={{ color: "var(--label-tertiary)", marginLeft: "auto", fontSize: 16 }}>
						×
					</button>
				</div>
			)}
			<textarea
				ref={areaRef}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						send();
					}
				}}
				placeholder={hero ? "Describe what you want to build" : "Message the agent"}
				rows={hero ? 2 : 1}
				aria-label="Message"
				style={{ width: "100%", resize: "none", border: "none", outline: "none", background: "transparent", fontSize: 15, lineHeight: 1.45, padding: "4px 6px", minHeight: hero ? 52 : 34, maxHeight: 200, overflow: "auto" }}
			/>
			<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
				<div ref={menuRef} style={{ position: "relative" }}>
					<button
						aria-label="Attach an image, or run a command"
						title="Attach an image, or run a command"
						onClick={() => setMenuOpen((v) => !v)}
						style={{ width: 28, height: 28, borderRadius: 999, background: "var(--selector)", display: "grid", placeItems: "center", fontSize: 18, lineHeight: 1, color: "var(--label-primary)" }}
					>
						+
					</button>
					{menuOpen && (
						<div role="menu" className="fade-up" style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, minWidth: 200, background: "var(--bg-layer-1)", border: "1px solid var(--border-l2)", borderRadius: 10, boxShadow: "var(--shadow-lv2)", padding: 6, zIndex: 50 }}>
							<button
								role="menuitem"
								onClick={() => {
									setMenuOpen(false);
									fileRef.current?.click();
								}}
								style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
								onPointerEnter={(e) => (e.currentTarget.style.background = "var(--interactive-hover)")}
								onPointerLeave={(e) => (e.currentTarget.style.background = "")}
							>
								Attach an image
							</button>
						</div>
					)}
					<input ref={fileRef} type="file" accept={ATTACH_ACCEPT} style={{ display: "none" }} tabIndex={-1} aria-hidden onChange={(e) => void attach(e.target.files?.[0])} />
				</div>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--label-secondary)", padding: "0 6px" }}>
					<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M8 1.5l5.5 2.5v4c0 3-2.3 5.4-5.5 6.5C4.8 13.4 2.5 11 2.5 8V4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
					Workspace Write
				</span>
				<span style={{ flex: 1 }} />
				<RoutingChip locked={busy} />
				<button
					onClick={send}
					disabled={busy || text.trim() === ""}
					aria-label="Send"
					style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "var(--accent-label)", display: "grid", placeItems: "center", opacity: busy || text.trim() === "" ? 0.45 : 1 }}
				>
					<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
				</button>
			</div>
		</div>
	);
}
