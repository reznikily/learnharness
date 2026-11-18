/** The success channel between the session model and the cards (pure, no DOM).
 *  One signal per key for the window's lifetime: a replayed turn cannot play
 *  again. It only waits for the card that is mounting right now; a later visit
 *  to the chat is history. */
const SIGNAL_TTL_MS = 1500;
const signaled = new Set<string>();
const waiting = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

export function signalSuccess(key: string): void {
	if (signaled.has(key)) return;
	signaled.add(key);
	waiting.set(key, Date.now() + SIGNAL_TTL_MS);
	// Newest first: a reused tool-call id belongs to the latest card.
	for (const listener of [...(listeners.get(key) ?? [])].reverse()) listener();
}

export function takeSuccess(key: string): boolean {
	const expiry = waiting.get(key);
	if (expiry === undefined) return false;
	waiting.delete(key);
	return Date.now() <= expiry;
}

export function subscribeSuccess(key: string, listener: () => void): () => void {
	const group = listeners.get(key) ?? new Set();
	listeners.set(key, group);
	group.add(listener);
	return () => {
		group.delete(listener);
		if (group.size === 0) listeners.delete(key);
	};
}
