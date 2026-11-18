"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { subscribeSuccess, takeSuccess } from "@/components/success-signal";

/**
 * Success feedback for events this window saw happen: a confirmed correct
 * answer, a confirmed conclude, a job finishing. The session model and the job
 * feed signal; the card holding the existing status plays it once. Nothing
 * here renders React state, so a played effect cannot return with a re-render,
 * a re-key or a reload of the transcript. Only transform and opacity animate
 * and the added nodes are absolutely positioned, so layout never moves.
 */

export type SuccessLevel = "celebrate" | "pop";

const freshJobs = new Set<string>();

/** Plays once for `key`'s signal, whether it lands before or after mount. */
export function useSuccessEffect(key: string | null, chipRef: RefObject<HTMLElement | null>, level: SuccessLevel): void {
	useEffect(() => {
		if (key === null) return;
		const play = () => {
			if (chipRef.current && takeSuccess(key)) playSuccess(chipRef.current, level);
		};
		play();
		return subscribeSuccess(key, play);
	}, [key, chipRef, level]);
}

export function playSuccess(chip: Element, level: SuccessLevel): void {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		chip.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
		return;
	}
	chip.animate([{ transform: "scale(0.9)" }, { transform: "scale(1)" }], {
		duration: 300,
		easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
	});
	if (level !== "celebrate") return;
	chip.closest("[data-success-root]")?.querySelectorAll("[data-success-row]").forEach(glare);
	sparks(chip);
}

function transient(parent: Element, style: Partial<CSSStyleDeclaration>): HTMLSpanElement {
	const node = document.createElement("span");
	node.setAttribute("aria-hidden", "true");
	Object.assign(node.style, { position: "absolute", pointerEvents: "none" }, style);
	parent.append(node);
	return node;
}

function glare(row: Element): void {
	const clip = transient(row, { inset: "0", borderRadius: "inherit", overflow: "hidden" });
	const sweep = transient(clip, { inset: "0", background: "linear-gradient(90deg, transparent, rgb(34 197 94 / 0.3), transparent)" });
	const animation = sweep.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }], {
		duration: 500,
		easing: "ease-out",
	});
	animation.onfinish = animation.oncancel = () => clip.remove();
}

function sparks(chip: Element): void {
	const { width } = chip.getBoundingClientRect();
	const reachX = Math.max(20, width / 2 + 6);
	for (let i = 0; i < 6; i++) {
		const angle = (i * Math.PI) / 3 + Math.PI / 6;
		const spark = transient(chip, { left: "50%", top: "50%", width: "4px", height: "4px", margin: "-2px", borderRadius: "50%", background: "rgb(34 197 94)" });
		const animation = spark.animate(
			[
				{ transform: "translate(0, 0) scale(1)", opacity: 1 },
				{ transform: `translate(${Math.cos(angle) * reachX}px, ${Math.sin(angle) * 20}px) scale(0.4)`, opacity: 0 },
			],
			{ duration: 450, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
		);
		animation.onfinish = animation.oncancel = () => spark.remove();
	}
}

export function markFreshJob(jobId: string): void {
	freshJobs.add(jobId);
}

/** Fades a job's artifact in when this window saw the job finish. History gets
 *  no wrapper at all, so its DOM and its demos' measurements stay untouched. */
export function FreshJobFade({ jobId, children }: { jobId?: string; children: ReactNode }) {
	const [fresh] = useState(() => jobId !== undefined && freshJobs.has(jobId));
	useEffect(() => {
		if (jobId !== undefined) freshJobs.delete(jobId);
	}, [jobId]);
	return fresh ? <div className="lh-fade-in">{children}</div> : <>{children}</>;
}
