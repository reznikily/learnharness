import React, { Children, isValidElement, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";

const ease = [0.32, 0.72, 0, 1] as const;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const subscribeMotion = (notify: () => void) => {
	reducedMotion.addEventListener("change", notify);
	return () => reducedMotion.removeEventListener("change", notify);
};
const motionSnapshot = () => reducedMotion.matches;
let directInput = false;
document.addEventListener("keydown", () => { directInput = true; }, true);
document.addEventListener("input", () => { directInput = true; }, true);
document.addEventListener("pointerdown", e => {
	directInput = e.target instanceof Element && !!e.target.closest("input,textarea,select,[contenteditable]");
}, true);

function Item({ children, instant, ref }: React.PropsWithChildren<{ instant: boolean; ref?: React.Ref<HTMLDivElement> }>) {
	const present = useIsPresent();
	return <motion.div
		ref={ref}
		className="min-w-0"
		inert={!present}
		aria-hidden={!present || undefined}
		layout={instant ? false : "position"}
		initial={instant ? false : { opacity: 0, transform: "translateY(4px)" }}
		animate={{ opacity: 1, transform: "translateY(0px)" }}
		exit={{ opacity: instant ? 1 : 0, transition: { duration: instant ? 0 : 0.12 } }}
		transition={{ duration: instant ? 0 : 0.24, ease }}
	>{children}</motion.div>;
}

/** Shared flow owns presence and position; text and controls never scale. */
export function Flow({ children, className }: React.PropsWithChildren<{ className: string }>) {
	const reduced = useSyncExternalStore(subscribeMotion, motionSnapshot);
	const instant = directInput || !!reduced;
	return <div className={`relative ${className}`}>
		<AnimatePresence initial={false} mode="popLayout">
			{Children.toArray(children).map((child, index) =>
				<Item key={isValidElement(child) ? child.key ?? index : index} instant={instant}>{child}</Item>)}
		</AnimatePresence>
	</div>;
}

/** Animate explanatory geometry; input values and their exact labels stay immediate. */
export function useAnimatedNumber(target: number): number {
	const reduced = useSyncExternalStore(subscribeMotion, motionSnapshot);
	const [value, setValue] = useState(target);
	const current = useRef(target);
	const instant = directInput || !!reduced;
	useLayoutEffect(() => {
		if (instant || !Number.isFinite(target) || !Number.isFinite(current.current)) {
			current.current = target;
			setValue(target);
			return;
		}
		const from = current.current;
		if (from === target) return;
		const start = performance.now();
		let frame = 0;
		function tick(now: number) {
			const progress = Math.min(1, (now - start) / 180);
			current.current = from + (target - from) * (1 - (1 - progress) ** 3);
			setValue(current.current);
			if (progress < 1) frame = requestAnimationFrame(tick);
		}
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [target, instant]);
	return instant ? target : value;
}
