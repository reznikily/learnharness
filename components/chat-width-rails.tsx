"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { clampFeedWidth, draggedFeedWidth, FEED_WIDTH_KEY, MIN_FEED_WIDTH, parseFeedWidth } from "./chat-width";

export function ChatWidthRails({ scopeRef, feedRef, bottom }: {
	scopeRef: RefObject<HTMLDivElement | null>;
	feedRef: RefObject<HTMLDivElement | null>;
	bottom: number;
}) {
	const railsRef = useRef<HTMLDivElement>(null);
	const preferred = useRef<number | null>(null);
	const drag = useRef<{ x: number; width: number; side: "left" | "right" } | null>(null);
	const [size, setSize] = useState({ width: 0, available: 0 });
	const [dragging, setDragging] = useState(false);

	function apply(width: number | null, available = (scopeRef.current ?? railsRef.current?.parentElement)?.clientWidth ?? 0) {
		const next = clampFeedWidth(width, available);
		// An inherited CSS variable would invalidate styles across the entire transcript.
		if (feedRef.current) feedRef.current.style.maxWidth = `${next}px`;
		setSize({ width: next, available });
	}
	function save(width: number) {
		preferred.current = width >= size.available ? null : width;
		try {
			if (preferred.current === null) localStorage.removeItem(FEED_WIDTH_KEY);
			else localStorage.setItem(FEED_WIDTH_KEY, String(preferred.current));
		} catch { /* Resizing still works when storage is unavailable. */ }
	}
	function finish() {
		if (!drag.current) return;
		drag.current = null;
		setDragging(false);
		save(size.width);
	}

	useLayoutEffect(() => {
		const scope = scopeRef.current ?? railsRef.current?.parentElement;
		const feed = feedRef.current;
		if (!scope || !feed) return;
		const originalMaxWidth = feed.style.maxWidth;
		try { preferred.current = parseFeedWidth(localStorage.getItem(FEED_WIDTH_KEY)); } catch { /* Use full width. */ }
		const resize = () => apply(preferred.current, scope.clientWidth);
		const storage = (event: StorageEvent) => {
			if (event.key !== FEED_WIDTH_KEY && event.key !== null) return;
			preferred.current = parseFeedWidth(event.newValue);
			resize();
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(scope);
		window.addEventListener("storage", storage);
		return () => { observer.disconnect(); window.removeEventListener("storage", storage); feed.style.maxWidth = originalMaxWidth; };
	}, [scopeRef, feedRef]);

	return (
		<div ref={railsRef} className="chat-width-rails" data-dragging={dragging || undefined}
			style={{ width: size.width || "100%", bottom, display: size.available <= MIN_FEED_WIDTH ? "none" : undefined }}>
			{dragging && <div className="chat-width-shield" />}
			{(["left", "right"] as const).map(side => (
				<div key={side} role="separator" tabIndex={0} aria-orientation="vertical"
					aria-label={side === "left" ? "Ширина ленты сообщений: левая граница" : "Ширина ленты сообщений: правая граница"}
					aria-valuemin={MIN_FEED_WIDTH} aria-valuemax={Math.round(size.available)} aria-valuenow={Math.round(size.width)}
					className="chat-width-handle" data-side={side}
					onPointerDown={event => {
						if (event.button !== 0) return;
						event.preventDefault();
						drag.current = { x: event.clientX, width: size.width, side };
						event.currentTarget.setPointerCapture(event.pointerId);
						setDragging(true);
					}}
					onPointerMove={event => {
						if (!drag.current) return;
						const next = draggedFeedWidth(drag.current.width, event.clientX - drag.current.x, drag.current.side, (scopeRef.current ?? railsRef.current?.parentElement)?.clientWidth ?? 0);
						preferred.current = next;
						apply(next);
					}}
					onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
					onKeyDown={event => {
						let next: number;
						if (event.key === "Home") next = MIN_FEED_WIDTH;
						else if (event.key === "End") next = size.available;
						else if (event.key === "ArrowLeft" || event.key === "ArrowRight")
							next = draggedFeedWidth(size.width, (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 40 : 8), side, size.available);
						else return;
						event.preventDefault();
						apply(next); save(next);
					}}
				><span /></div>
			))}
		</div>
	);
}
